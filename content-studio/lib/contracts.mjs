import {createHash} from 'node:crypto';

export const target = 'https://www.linkedin.com/company/fazal-it/home/';
export const stageNames = ['Research', 'Brand brief', 'Creation', 'Independent review', 'Publish preparation'];
export const sha = value => createHash('sha256').update(value).digest('hex');
export function dateInPakistan(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}
export function canonicalURL(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('HTTPS source required');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}
export function requireCheck(condition, message) {
  if (!condition) throw new Error(message);
}
export function verifyResearch(data, evidence, history, localDate) {
  requireCheck(data.topic.trim() && data.claims.length >= 2 && data.sources.length, 'No verified story');
  const heard = new Set(evidence.map(canonicalURL));
  const duplicates = new Set(history.map(canonicalURL));
  const dates = Date.parse(localDate);
  const seen = new Set();
  for (const source of data.sources) {
    source.url = canonicalURL(source.url);
    const time = Date.parse(source.date);
    requireCheck(/^\d{4}-\d{2}-\d{2}$/.test(source.date) && Number.isFinite(time) &&
      new Date(time).toISOString().slice(0, 10) === source.date &&
      time <= dates && dates - time <= 7 * 86400000, 'Source outside the seven-day window');
    requireCheck(heard.has(source.url) && !duplicates.has(source.url) && !seen.has(source.url), 'Source missing from tool evidence or repeated');
    requireCheck(source.publisher.trim() && source.section.trim(), 'Source publisher and section are required');
    seen.add(source.url);
  }
  const claimIds = new Set();
  for (const claim of data.claims) {
    claim.url = canonicalURL(claim.url);
    requireCheck(claim.id.trim() && claim.text.trim() && !claimIds.has(claim.id) && seen.has(claim.url), 'Invalid claim evidence link');
    claimIds.add(claim.id);
  }
  return data;
}
export function checkClaims(ids, allowed) {
  requireCheck(ids.length && new Set(ids).size === ids.length && ids.every(id => allowed.includes(id)), 'Unexpected claim ID');
}
function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}
export function wrap(stage, parent, output) {
  const envelope = {stage, parent: parent?.hash ?? null, output};
  return {...envelope, hash: sha(stable(envelope))};
}
export function checkChain(stages, through) {
  for (let stage = 1; stage <= through; stage++) {
    const actual = stages[stage];
    requireCheck(actual?.hash === wrap(stage, stages[stage - 1], actual?.output).hash, 'Invalid handoff at stage ' + stage);
  }
}
export function artifactHash({image, caption, alt, revision}) {
  return sha(stable({revision, target, image: sha(Buffer.from(image, 'base64')), caption, alt}));
}
export function allPass(review) {
  return ['factual','visual','brand'].every(key => review?.[key] === 'PASS');
}
