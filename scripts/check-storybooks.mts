// Checks every storybook (Christmas, program stories, monthly extras): art exists, ids unique, page length rules,
// {{name}} rules, no em dashes or banned words, each page's scene exists in its theme. Exit 1 on any problem.
// Usage: npx tsx scripts/check-storybooks.mts
import { existsSync } from 'node:fs';
import { BOOKS } from '../src/lib/storybook/catalog';
import { EXTRA_STORIES } from '../src/lib/storybook/extra';
import { sceneById } from '../src/lib/program/scenes';
import { STORY_TEXTS } from '../src/lib/program/storyTexts';
const bad: string[] = [];
const ids = new Set<string>();
const banned = /\bunlock|seamless|elevate|dive in|game[- ]changer|—|–/i;
const words = (t: string) => (t.replace(/\{\{name\}\}/g, ' kid ').toLowerCase().match(/[a-z0-9']+/g) ?? []).length;
const sentences = (t: string) => t.split(/(?<=[.!?]["”]?)\s+(?=["“]?[A-Z{0-9])/).filter(Boolean).length;
for (const b of BOOKS) {
  if (ids.has(b.id)) bad.push(`duplicate id ${b.id}`); ids.add(b.id);
  for (const p of [b.cover, ...b.pages]) if (!existsSync('public' + p.src)) bad.push(`${b.id}: missing art ${p.src}`);
  if (b.pages.length < 6 || b.pages.length > 12) bad.push(`${b.id}: ${b.pages.length} pages (6 to 12)`);
  if (!b.pages.some((p) => p.text.includes('{{name}}'))) bad.push(`${b.id}: {{name}} never appears`);
  for (const [i, p] of b.pages.entries()) {
    const t = p.text;
    if (/[{}]/.test(t.replace(/\{\{name\}\}/g, ''))) bad.push(`${b.id} p${i + 1}: stray braces`);
    if (banned.test(t)) bad.push(`${b.id} p${i + 1}: banned word or dash`);
    const max = b.level === 'pre-k' ? [2, 14] : [3, 30];
    if (b.added && (sentences(t) > max[0] || words(t) > max[1])) bad.push(`${b.id} p${i + 1}: too long for ${b.level} (${sentences(t)} sentences, ${words(t)} words)`);
  }
}
for (const x of EXTRA_STORIES) {
  if (STORY_TEXTS[x.theme]?.[x.id]) bad.push(`${x.theme}/${x.id}: reuses a program path id`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x.added)) bad.push(`${x.theme}/${x.id}: added must be YYYY-MM-DD`);
  for (const [scene] of x.pages) if (!sceneById(x.theme, scene)) bad.push(`${x.theme}/${x.id}: no scene ${scene} in ${x.theme}`);
}
console.log(`${BOOKS.length} storybooks (${EXTRA_STORIES.length} monthly extras), ${bad.length} problems`);
for (const b of bad) console.log(' -', b);
process.exit(bad.length ? 1 : 0);
