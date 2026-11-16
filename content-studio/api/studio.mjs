import {timingSafeEqual} from 'node:crypto';
import {allPass, artifactHash, checkChain, target} from '../lib/contracts.mjs';

function authorized(req, secret) {
  if (!secret || secret.length < 24) return false;
  const actual = Buffer.from(req.headers.authorization || '');
  const expected = Buffer.from('Bearer ' + secret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function response(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(value));
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const url = new URL(req.url, 'http://localhost');
  const action = url.searchParams.get('action');
  const id = url.searchParams.get('id');
  const cron = action === 'cron';
  if (!authorized(req, cron ? process.env.CRON_SECRET : process.env.OWNER_TOKEN)) {
    return response(res,401,{error:'A valid studio token is required.'});
  }
  const method = ['create','step','retry','approve','revise'].includes(action) ? 'POST' : 'GET';
  if (req.method !== method) return response(res,405,{error:'Unsupported request method.'});
  if (!process.env.DATABASE_URL) return response(res,503,{error:'Set DATABASE_URL and apply db/schema.sql.'});
  try {
    const [store,{step,toView}] = await Promise.all([import('../lib/store.mjs'),import('../lib/runner.mjs')]);
    if (cron) {
      const daily = await store.newRun('scheduled');
      const run = await step(daily);
      return response(res,200,{id:daily,status:run.status,nextStage:run.next_stage});
    }
    if (!action || action === 'list') return response(res,200,{runs:(await store.listRuns()).map(toView)});
    if (action === 'create') return response(res,201,{id:await store.newRun('test')});
    if (!id || !/^FZIT-\d{8}-(DAILY|TEST-[a-f0-9]{8})$/.test(id)) return response(res,400,{error:'Valid run ID required.'});
    const run = await store.getRun(id);
    if (!run) return response(res,404,{error:'Run not found.'});
    if (action === 'get') return response(res,200,toView(run));
    if (action === 'step') return response(res,200,await step(id));
    if (action === 'retry') return response(res, (await store.retry(id)) ? 200 : 409, {id});
    if (action === 'image') {
      const creation = run.stages[3]?.output;
      if (!creation) return response(res,404,{error:'Image not created.'});
      checkChain(run.stages,3);
      res.statusCode = 200;
      res.setHeader('Content-Type','image/png');
      return res.end(Buffer.from(creation.image,'base64'));
    }
    if (action === 'approve' || action === 'revise') {
      let body;
      try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
      catch { return response(res,400,{error:'Expected a JSON request body.'}); }
      const packet = run.stages[5]?.output;
      if (!packet || run.status !== 'review' || packet.revision !== body?.revision ||
        packet.payloadHash !== body?.payloadHash || body?.target !== target || packet.target !== target) {
        return response(res,409,{error:'Reload and select the current exact revision.'});
      }
      checkChain(run.stages,5);
      if (artifactHash(run.stages[3].output) !== packet.payloadHash) return response(res,409,{error:'Payload fingerprint changed.'});
      if (action === 'revise') {
        const note = typeof body.note === 'string' ? body.note.trim().slice(0,1000) : '';
        if (!note) return response(res,400,{error:'Describe the requested changes.'});
        return (await store.revise(id,packet.payloadHash,note))
          ? response(res,200,{id}) : response(res,409,{error:'Revision limit reached or run changed.'});
      }
      if (!allPass(packet.qa)) return response(res,409,{error:'All three QA checks must pass before approval.'});
      return (await store.approve(run,packet.payloadHash))
        ? response(res,200,{id}) : response(res,409,{error:'Run changed. Reload and review again.'});
    }
    return response(res,404,{error:'Unknown studio action.'});
  } catch (error) {
    console.error('Studio request failed', {action,type:error.name});
    return response(res,500,{error:'Studio operation failed. Check the database schema and runtime configuration.'});
  }
}
