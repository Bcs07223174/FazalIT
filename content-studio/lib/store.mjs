import {neon} from '@neondatabase/serverless';
import {randomUUID} from 'node:crypto';
import {dateInPakistan} from './contracts.mjs';

const db = () => neon(process.env.DATABASE_URL);
const json = data => JSON.stringify(data);
const event = (type, details = {}) => json([{type, at:new Date().toISOString(), ...details}]);
const viewColumns = 'id,local_date::text as local_date,mode,next_stage,revision,status,error,events,updated_at';
export async function listRuns() {
  return db().query('select ' + viewColumns + ' from content_runs order by created_at desc limit 50');
}
export async function getRun(id) {
  const [row] = await db().query('select *,local_date::text as local_date from content_runs where id = $1', [id]);
  return row;
}
export async function newRun(mode) {
  const date = dateInPakistan();
  const prefix = 'FZIT-' + date.replaceAll('-','');
  const id = mode === 'scheduled' ? prefix + '-DAILY' : prefix + '-TEST-' + randomUUID().slice(0,8);
  await db().query('insert into content_runs (id,local_date,mode,events) values ($1,$2,$3,$4::jsonb) on conflict do nothing',
    [id,date,mode,event('created')]);
  return id;
}
export async function history(run) {
  const rows = await db().query(
    "select stages->'1'->'output' as research from content_runs where id <> $1 and local_date >= $2::date - 14 and local_date <= $2::date and mode = 'scheduled' and stages ? '1'",
    [run.id,run.local_date]);
  return rows.map(({research}) => ({topic:research.topic, urls:research.sources.map(source => source.url)}));
}
export async function lease(id) {
  const leaseId = randomUUID();
  const [row] = await db().query(
    "update content_runs set status='running', lease_id=$2, lease_until=now()+interval '6 minutes', updated_at=now() where id=$1 and next_stage <= 5 and status in ('queued','running') and (lease_until is null or lease_until < now()) returning *,local_date::text as local_date",
    [id,leaseId]);
  return row;
}
export async function advance(run, {stages, revision, next, status, corrections}) {
  const updated = await db().query(
    'update content_runs set stages=$3::jsonb,revision=$4,next_stage=$5,status=$6,corrections=$7::jsonb,error=null,lease_id=null,lease_until=null,events=events||$8::jsonb,updated_at=now() where id=$1 and lease_id=$2 returning id',
    [run.id,run.lease_id,json(stages),revision,next,status,json(corrections),
      event('stage_complete',{stage:run.next_stage,revision:run.revision})]);
  return updated.length > 0;
}
export async function stop(run, message) {
  await db().query(
    "update content_runs set status='blocked',error=$3,lease_id=null,lease_until=null,events=events||$4::jsonb,updated_at=now() where id=$1 and lease_id=$2",
    [run.id,run.lease_id,message,event('stage_blocked',{stage:run.next_stage,revision:run.revision})]);
}
export async function retry(id) {
  const rows = await db().query(
    "update content_runs set status='queued',error=null,events=events||$2::jsonb,updated_at=now() where id=$1 and status='blocked' and next_stage <= 5 and lease_id is null returning id",
    [id,event('retry')]);
  return Boolean(rows.length);
}
export async function revise(id, hash, note) {
  const rows = await db().query(
    "update content_runs set stages=jsonb_build_object('1',stages->'1'),revision=revision+1,next_stage=2,status='queued',error=null,corrections=jsonb_build_array($3::text),events=events||$4::jsonb,updated_at=now() where id=$1 and status='review' and revision < 3 and stages->'5'->'output'->>'payloadHash'=$2 returning id",
    [id,hash,note,event('revision_requested')]);
  return Boolean(rows.length);
}
export async function approve(run, expectedHash) {
  const rows = await db().query(
    "update content_runs set status='approved',events=events||$3::jsonb,updated_at=now() where id=$1 and status='review' and stages->'5'->'output'->>'payloadHash'=$2 returning id",
    [run.id,expectedHash,event('owner_approved',{revision:run.revision,payloadHash:expectedHash})]);
  return Boolean(rows.length);
}
