const byId = id => document.getElementById(id);
const labels = ['Research','Brand brief','Creation','Independent review','Publish preparation'];
let token = '';
let selected = null;
let imageUrl;
let busy = false;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function notice(text) {
  byId('feedback').textContent = text;
  byId('feedback').hidden = !text;
}
async function request(action, {id, post, payload} = {}) {
  const params = new URLSearchParams({action});
  if (id) params.set('id',id);
  const reply = await fetch('/api/studio?' + params, {
    method:post ? 'POST' : 'GET', cache:'no-store',
    headers:{Authorization:'Bearer ' + token, ...(payload ? {'Content-Type':'application/json'} : {})},
    body:payload ? JSON.stringify(payload) : undefined,
  });
  if (reply.ok && action === 'image') return reply.blob();
  const data = await reply.json();
  if (!reply.ok) throw new Error(data.error || 'The operation could not be completed.');
  return data;
}
async function perform(callback) {
  if (busy) return;
  busy = true;
  const buttons = [...document.querySelectorAll('button')].filter(button => !button.disabled);
  buttons.forEach(button => button.disabled = true);
  notice('');
  try { await callback(); }
  catch (error) { notice(error.message); }
  finally { busy = false; buttons.forEach(button => button.disabled = false); }
}
function button(label, callback, className) {
  const control = element('button',label,className);
  control.type = 'button';
  control.addEventListener('click',() => perform(callback));
  return control;
}
function displayPipeline(run) {
  byId('pipeline').replaceChildren(...labels.map((label,index) => {
    const stage = index + 1;
    const complete = run?.completed?.includes(stage);
    const current = run?.next_stage === stage;
    const node = element('li',undefined,current ? 'active' : '');
    node.append(element('small','Agent ' + String(stage).padStart(2,'0')),element('strong',label),
      element('small',complete ? 'Complete' : current ? run.status === 'blocked' ? 'Blocked' : 'Current stage' : 'Waiting'));
    return node;
  }));
}
async function updateList() {
  const {runs} = await request('list');
  byId('run-count').textContent = runs.length + ' runs';
  byId('runs').replaceChildren(...runs.map(run => {
    const row = element('li');
    const item = button(run.id,async () => { await selectRun(run.id); await updateList(); },'run-button');
    item.append(element('small',run.status));
    if (selected === run.id) item.setAttribute('aria-current','true');
    row.append(item);
    return row;
  }));
  if (!runs.length) byId('runs').append(element('li','No runs yet.','muted'));
}
async function selectRun(id) {
  const run = await request('get',{id});
  selected = id;
  displayPipeline(run);
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = undefined;
  const root = byId('detail');
  const heading = element('div',undefined,'card-title');
  heading.append(element('h2',run.id),element('span',run.status,'badge ' + run.status));
  root.replaceChildren(heading,element('p','Revision ' + run.revision + ' · ' + run.mode,'muted'));
  if (run.error) root.append(element('p',run.error));
  const actions = element('div',undefined,'actions');
  if (['queued','running'].includes(run.status)) actions.append(button('Run remaining stages',async () => {
    for (let attempt = 0; attempt < 13; attempt++) {
      notice('Running ' + id + '…');
      const state = await request('step',{id,post:true});
      displayPipeline(state);
      if (state.status !== 'queued') break;
    }
    notice('');
    await selectRun(id);
    await updateList();
  }));
  if (run.status === 'blocked') actions.append(button('Retry stage',async () => {
    await request('retry',{id,post:true}); await selectRun(id); await updateList();
  }));
  root.append(actions);
  if (run.research) {
    root.append(element('h3',run.research.topic),element('p',run.research.freshness,'muted'));
    const sources = element('ul',undefined,'sources');
    for (const source of run.research.sources) {
      const row = element('li');
      const link = element('a',source.publisher + ' · ' + source.date);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      row.append(link);
      sources.append(row);
    }
    root.append(sources);
  }
  if (run.review) {
    const qa = element('div',undefined,'actions');
    for (const key of ['factual','visual','brand']) qa.append(element('span',key + ' ' + run.review[key],'badge ' + run.review[key].toLowerCase()));
    root.append(element('h3','Independent review'),qa);
    if (run.review.issues.length) {
      const issues = element('ul',undefined,'issues');
      for (const issue of run.review.issues) issues.append(element('li',issue));
      root.append(issues);
    }
  }
  if (run.packet) {
    const packet = run.packet;
    const grid = element('div',undefined,'packet');
    const artwork = element('div');
    const picture = element('img');
    picture.alt = packet.alt;
    artwork.append(picture);
    const copy = element('div');
    copy.append(element('h3','Caption'),element('p',packet.caption,'caption'),
      element('h3','Alt text'),element('p',packet.alt));
    const target = element('a','Fazal IT LinkedIn company page');
    target.href = packet.target;
    target.target = '_blank';
    target.rel = 'noopener noreferrer';
    copy.append(target);
    grid.append(artwork,copy);
    root.append(grid);
    try {
      imageUrl = URL.createObjectURL(await request('image',{id}));
      picture.src = imageUrl;
      const download = element('a','Download graphic');
      download.href = imageUrl;
      download.download = id + '-R' + packet.revision + '.png';
      artwork.append(download);
    } catch (error) { artwork.replaceChildren(element('p',error.message)); }
    if (run.status === 'review') {
      const payload = {revision:packet.revision,payloadHash:packet.payloadHash,target:packet.target};
      if (packet.readiness === 'AWAITING_OWNER_APPROVAL') {
        actions.append(button('Approve revision ' + packet.revision,async () => {
          if (!window.confirm('Approve this exact image, caption and alt text for the Fazal IT company page?')) return;
          await request('approve',{id,post:true,payload});
          await selectRun(id); await updateList();
        }));
      }
      if (run.revision < 3) actions.append(button('Request changes',async () => {
        const note = window.prompt('What should change in the next revision?');
        if (!note?.trim()) return;
        await request('revise',{id,post:true,payload:{...payload,note}});
        await selectRun(id); await updateList();
      },'secondary'));
    }
  }
}
byId('login-form').addEventListener('submit',event => {
  event.preventDefault();
  perform(async () => {
    token = byId('token').value;
    try { await updateList(); }
    catch (error) { token=''; throw error; }
    byId('token').value = '';
    byId('login').hidden = true;
    byId('studio').hidden = false;
    byId('logout').hidden = false;
    displayPipeline();
  });
});
byId('logout').addEventListener('click',() => window.location.reload());
byId('new').addEventListener('click',() => perform(async () => {
  const {id} = await request('create',{post:true});
  await selectRun(id); await updateList();
}));
byId('refresh').addEventListener('click',() => perform(async () => {
  await updateList();
  if (selected) await selectRun(selected);
}));
