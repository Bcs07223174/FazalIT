import {execFileSync} from 'node:child_process';

const [owner, number] = process.argv.slice(2);
if (!owner || !/^\d+$/.test(number || '')) {
  console.error('Usage: node scripts/seed-board.mjs OWNER PROJECT_NUMBER');
  process.exit(1);
}
const gh = args => execFileSync('gh',args,{encoding:'utf8'});
const {items} = JSON.parse(gh(['project','item-list',number,'--owner',owner,'--format','json','--limit','200']));
const existing = new Set(items.map(item => item.title));
const cards = [
  ['Run CI','Pass Node contract tests and Cypress checks in GitHub Actions.'],
  ['Configure brand kit','Confirm master PNG, fingerprint and accent color.'],
  ['Provision Vercel and Neon','Deploy to an eligible Vercel team and apply the database schema. Set scoped secrets.'],
  ['Verify live generation','Run all five stages with real providers and inspect the privately stored packet.'],
  ['Verify revision approval','Check brand and payload holds, then approve one exact passing revision.'],
  ['Cut over daily scheduling','Verify one daily 09:00 Pakistan run and its visible packet before retiring the previous trigger.'],
];
for (const [title,body] of cards) {
  if (!existing.has(title)) console.log(gh(['project','item-create',number,'--owner',owner,'--title',title,'--body',body]));
}
