import sharp from 'sharp';
import {ask, makeImage} from './model.mjs';
import {allPass, artifactHash, canonicalURL, checkClaims, requireCheck, sha, target, verifyResearch} from './contracts.mjs';

async function research(run, history) {
  const result = await ask('research', 'Find 3–5 credible recent AI and automation stories for SME owners. Pick one after checking the past 72 hours first. Expand to seven days if needed and disclose it. Open official sources and cite each source URL. Distinguish vendor claims and avoid repeated sources or topics. Dates are Pakistan calendar dates. Return an empty source list if none qualify.', {today:run.local_date, history});
  const urls = history.flatMap(item => item.urls);
  const record = verifyResearch(result.data, result.evidence, urls, run.local_date);
  requireCheck(!history.some(item => item.topic.toLowerCase() === record.topic.toLowerCase()), 'Topic has already been used');
  return record;
}

async function brand(research, corrections) {
  const color = process.env.BRAND_COLOR || '#087DB4';
  requireCheck(/^#[0-9a-f]{6}$/i.test(color), 'BRAND_COLOR must be a six-digit HEX color');
  const logoURL = process.env.BRAND_LOGO_URL || '';
  const logoHash = process.env.BRAND_LOGO_SHA256 || '';
  requireCheck(Boolean(logoURL) === Boolean(logoHash) && (!logoHash || /^[a-f0-9]{64}$/.test(logoHash)), 'Master logo configuration is incomplete');
  if (logoURL) canonicalURL(logoURL);
  const identity = {name:process.env.BRAND_NAME || 'Fazal IT', color, logoURL, logoHash, status:logoHash ? 'APPROVED' : 'HOLD'};
  const {data} = await ask('brand', 'Write concise, exact on-image text. Headline under 68 characters, support below 78. Use accurate wording supported by the claim IDs. Give a visual brief for a text-free illustration on white, with no logo, labels or words in the image. Use professional English.', {research, identity:{name:identity.name,color}, corrections});
  requireCheck(Boolean(data.headline.trim()) && data.headline.length < 68 && data.support.length < 78, 'Graphic text exceeds layout limits');
  checkClaims(data.claimIds, research.claims.map(c => c.id));
  return {...data, identity};
}

const escapeXML = text => text.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
function lines(text, limit) {
  return text.trim().split(/\s+/).reduce((rows, word) => {
    if (rows.length && rows.at(-1).length + word.length + 1 <= limit) rows[rows.length - 1] += ' ' + word;
    else rows.push(word);
    return rows;
  }, []);
}
async function render(brief) {
  const artwork = await makeImage('Create a square editorial illustration with a clean white background. Absolutely no writing, logo, letters, numbers, text or watermark. Use restrained cool cyan accents. ' + brief.visualPrompt);
  const panel = await sharp(artwork).resize(1000, 580, {fit:'contain', background:'#ffffff'}).png().toBuffer();
  const {color, name, logoURL, logoHash} = brief.identity;
  const headline = lines(brief.headline, 28);
  const support = lines(brief.support, 53);
  const headlineText = headline.map((line, index) => '<text x="82" y="' + (190 + index * 66) + '" font-size="58" font-weight="700">' + escapeXML(line) + '</text>').join('');
  const supportText = support.map((line, index) => '<text x="82" y="' + (190 + headline.length * 66 + index * 40) + '" font-size="31">' + escapeXML(line) + '</text>').join('');
  const header = logoURL ? '' : '<text x="82" y="94" font-size="31" font-weight="700">' + escapeXML(name) + '</text>';
  const typography = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><rect width="1200" height="16" fill="' + color + '"/><g fill="#142636" font-family="sans-serif">' + header + headlineText + supportText + '</g></svg>');
  const layers = [{input:panel, left:100, top:565}, {input:typography, left:0, top:0}];
  if (logoURL) {
    const response = await fetch(logoURL, {signal:AbortSignal.timeout(8000), redirect:'error'});
    requireCheck(response.ok, 'Master logo download failed');
    const bytes = Buffer.from(await response.arrayBuffer());
    requireCheck(bytes.length <= 2_000_000 && sha(bytes) === logoHash, 'Master logo fingerprint changed');
    const metadata = await sharp(bytes).metadata();
    requireCheck(metadata.format === 'png', 'Master logo must be a PNG');
    layers.push({input:await sharp(bytes).resize(258, 62, {fit:'inside'}).png().toBuffer(), left:82, top:42});
  }
  return sharp({create:{width:1200,height:1200,channels:3,background:'#ffffff'}})
    .composite(layers).png({compressionLevel:9}).toBuffer();
}

async function create(run, research, brief) {
  const claims = research.claims.filter(claim => brief.claimIds.includes(claim.id));
  const {data} = await ask('caption', 'Draft a LinkedIn caption in plain English for SME owners. Map every factual sentence to one or more supplied claim IDs. Use a non-factual hook, distinguish the Fazal IT interpretation as advice, and avoid adding any unsupported claim. Give a practical CTA, 3–5 hashtags with the # prefix, and alt text including the exact headline and support. Do not output URLs in the caption lines. Sources will be appended.', {topic:research.topic, brief:{...brief,identity:undefined}, claims, corrections:run.corrections});
  requireCheck(data.captionLines.length && data.alt.trim() && data.hook.trim(), 'Caption and alt text are required');
  for (const line of data.captionLines) {
    requireCheck(line.text.trim() && !/https?:\/\//i.test(line.text), 'Invalid factual caption line');
    checkClaims(line.claimIds, brief.claimIds);
  }
  requireCheck(data.hashtags.length >= 3 && data.hashtags.length <= 5 && data.hashtags.every(tag => /^#[\p{L}\p{N}_]+$/u.test(tag)), 'Invalid hashtags');
  const urls = new Set(claims.map(claim => claim.url));
  const sourceLines = research.sources.filter(source => urls.has(source.url)).map(source => source.publisher + ' (' + source.date + ') ' + source.url);
  const caption = [data.hook, data.captionLines.map(line => line.text).join(' '), 'Fazal IT takeaway: ' + data.takeaway, data.callToAction, sourceLines.join('\n'), data.hashtags.join(' ')].filter(Boolean).join('\n\n');
  const image = await render(brief);
  requireCheck(image.length < 3_000_000, 'Image exceeds delivery size limit');
  const output = {caption, alt:data.alt, image:image.toString('base64'), revision:run.revision,
    dimensions:{width:1200,height:1200,format:'png'}, mappings:data.captionLines, sourceUrls:[...urls]};
  return {...output, payloadHash:artifactHash(output)};
}

async function review(research, brief, creation) {
  requireCheck(artifactHash(creation) === creation.payloadHash, 'Creation payload fingerprint changed');
  const {data, visited} = await ask('review', 'Open each exact source URL again with web search. Independently review all image and caption text, including the hook and advice. Check dates, caveats, exact graphic strings, contrast, spelling, mobile legibility, clipping, alt text, and whether illustration contains accidental text. Return CHANGES_REQUIRED for defects and HOLD for checks you cannot verify. Report exact source URLs actually reopened. Return concise actionable issues for every non-pass.', {
    research, imageText:[brief.headline,brief.support], caption:creation.caption, alt:creation.alt, sourceUrls:creation.sourceUrls, mappings:creation.mappings,
  }, {web:true,image:creation.image});
  const opened = new Set(visited.map(canonicalURL));
  const reported = new Set(data.reopened.map(canonicalURL));
  const reopened = creation.sourceUrls.filter(url => opened.has(url) && reported.has(url));
  if (reopened.length !== creation.sourceUrls.length) {
    if (data.factual === 'PASS') data.factual = 'HOLD';
    data.issues.push('The review tool did not record reopening every exact primary URL.');
  }
  const brand = brief.identity.status === 'APPROVED' ? data.visual : 'HOLD';
  if (brand === 'HOLD' && brief.identity.status === 'HOLD') data.issues.push('Owner-confirmed master logo and color are required.');
  return {...data, reopened, brand, payloadHash:creation.payloadHash};
}

function prepare(run, creation, review) {
  requireCheck(review.payloadHash === creation.payloadHash && artifactHash(creation) === creation.payloadHash, 'Reviewed revision does not match packet');
  return {postId:run.id, revision:run.revision, target, caption:creation.caption, alt:creation.alt,
    payloadHash:creation.payloadHash, sourceUrls:creation.sourceUrls, dimensions:creation.dimensions,
    readiness: allPass(review) ? 'AWAITING_OWNER_APPROVAL' : 'BLOCKED',
    qa:{factual:review.factual,visual:review.visual,brand:review.brand},
    ownerApproval:null, published:false};
}

export function runWorker(stage, run, history) {
  const artifacts = run.stages;
  const get = index => artifacts[index].output;
  switch (stage) {
    case 1: return research(run, history);
    case 2: return brand(get(1), run.corrections);
    case 3: return create(run, get(1), get(2));
    case 4: return review(get(1), get(2), get(3));
    case 5: return prepare(run, get(3), get(4));
    default: throw new Error('Unrecognized worker stage');
  }
}
