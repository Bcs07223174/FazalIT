import test from 'node:test';
import assert from 'node:assert/strict';
import {allPass,artifactHash,canonicalURL,checkChain,checkClaims,dateInPakistan,verifyResearch,wrap} from '../lib/contracts.mjs';

const url = 'https://example.com/announcement';
const fixture = () => ({
  topic:'Example launch', sources:[{url,date:'2026-11-16',publisher:'Example',section:'Availability'}],
  claims:[{id:'C1',text:'A test claim',url},{id:'C2',text:'A second claim',url}],
});

test('Pakistan local date rolls over at 19:00 UTC', () => {
  assert.equal(dateInPakistan(new Date('2026-11-16T20:00:00Z')),'2026-11-17');
});
test('research validates tool evidence, freshness and duplicate history', () => {
  assert.deepEqual(verifyResearch(fixture(),[url],[],'2026-11-17'),fixture());
  assert.throws(() => verifyResearch(fixture(),[url],[url + '?utm_source=test'],'2026-11-17'),/repeated/);
  assert.throws(() => verifyResearch(fixture(),[],[],'2026-11-17'),/tool evidence/);
  assert.throws(() => verifyResearch(fixture(),[url],[],'2026-11-15'),/seven-day window/);
  assert.throws(() => verifyResearch(fixture(),[url],[],'2026-11-25'),/seven-day window/);
  assert.throws(() => canonicalURL('http://example.com/'),/HTTPS/);
});
test('invalid and repeated claim IDs are rejected', () => {
  assert.doesNotThrow(() => checkClaims(['C2'],['C1','C2']));
  assert.throws(() => checkClaims(['C2','C2'],['C2']),/claim ID/);
  assert.throws(() => checkClaims(['C3'],['C1']),/claim ID/);
});
test('changing a stage invalidates dependent handoffs', () => {
  const first = wrap(1,null,fixture());
  const second = wrap(2,first,{headline:'Headline'});
  assert.doesNotThrow(() => checkChain({1:first,2:second},2));
  assert.throws(() => checkChain({1:wrap(1,null,{topic:'Updated'}),2:second},2),/stage 2/);
  assert.throws(() => checkChain({1:first},2),/stage 2/);
  assert.doesNotThrow(() => checkChain({1:{...first,output:JSON.parse(JSON.stringify(first.output))}},1));
});
test('change to caption, image, alt text or revision changes approval hash', () => {
  const payload = {image:'dGVzdA==',caption:'A',alt:'B',revision:1};
  const hash = artifactHash(payload);
  for (const patch of [{caption:'C'},{alt:'C'},{revision:2},{image:'dGVzdDI='}]) {
    assert.notEqual(artifactHash({...payload,...patch}),hash);
  }
  assert.equal(allPass({factual:'PASS',visual:'PASS',brand:'HOLD'}),false);
  assert.equal(allPass({factual:'PASS',visual:'PASS',brand:'PASS'}),true);
});
