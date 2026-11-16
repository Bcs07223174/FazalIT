import {execFileSync} from 'node:child_process';

const [owner, number] = process.argv.slice(2);
if (!owner || !/^\d+$/.test(number || '')) {
  console.error('Usage: node scripts/seed-board.mjs OWNER PROJECT_NUMBER');
  process.exit(1);
}

const gh = args => execFileSync('gh', args, {encoding:'utf8'});
const {items} = JSON.parse(gh(['project','item-list',number,'--owner',owner,'--format','json','--limit','200']));
const existing = new Set(items.map(item => item.content?.url));
const issueURLs = [
  "https://github.com/Bcs07223174/FazalIT/issues/2",
  "https://github.com/Bcs07223174/FazalIT/issues/3",
  "https://github.com/Bcs07223174/FazalIT/issues/4",
  "https://github.com/Bcs07223174/FazalIT/issues/5",
  "https://github.com/Bcs07223174/FazalIT/issues/6",
  "https://github.com/Bcs07223174/FazalIT/issues/7"
];
for (const url of issueURLs) {
  if (!existing.has(url)) gh(['project','item-add',number,'--owner',owner,'--url',url]);
}
