import * as store from './store.mjs';
import {runWorker} from './workers.mjs';
import {checkChain, wrap} from './contracts.mjs';

export function toView(run) {
  if (!run) return null;
  const {id,local_date,mode,next_stage,revision,status,error,updated_at,events} = run;
  const view = {id,local_date,mode,next_stage,revision,status,error,updated_at,events};
  if (!run.stages) return view;
  const stages = run.stages;
  const creation = stages[3]?.output;
  return {...view, completed:Object.keys(stages).map(Number),
    research:stages[1]?.output, review:stages[4]?.output, packet:stages[5] && {...stages[5].output, ownerApproval:events.findLast(event => event.type === 'owner_approved') ?? null},
    imageReady:Boolean(creation), imageHash:creation?.payloadHash};
}
export async function step(id) {
  const run = await store.lease(id);
  if (!run) return toView(await store.getRun(id));
  const stage = run.next_stage;
  try {
    checkChain(run.stages, stage - 1);
    // Each stage executes in a separate request with only its required inputs.
    const result = await runWorker(stage, run, stage === 1 ? await store.history(run) : []);
    const stages = {...run.stages, [stage]:wrap(stage, run.stages[stage - 1], result)};
    const needsChanges = stage === 4 && [result.factual,result.visual,result.brand].includes('CHANGES_REQUIRED');
    if (needsChanges && run.revision < 3) {
      await store.advance(run, {stages:{1:stages[1]}, revision:run.revision + 1, next:2, status:'queued', corrections:result.issues});
    } else {
      await store.advance(run, {stages, revision:run.revision, next:stage + 1,
        status:stage === 5 ? 'review' : 'queued', corrections:run.corrections});
    }
  } catch (error) {
    // Keep connection strings and raw provider errors out of the activity feed.
    const known = /^(?:AI |Image |Master |OPENAI_|BRAND_|Source |Invalid |No |Unexpected |Topic |Graphic |Caption |Creation |Reviewed |Unrecognized )/;
    const message = known.test(error.message) ? error.message.slice(0,180) : 'Stage failed. Check server logs and provider configuration.';
    console.error('Workflow stage failed', {id,stage,errorType:error.name});
    await store.stop(run, message);
  }
  return toView(await store.getRun(id));
}
