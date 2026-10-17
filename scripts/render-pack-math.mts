// Render check for the Pre-K extra math page: the find the number page for every number of the week, and the
// plan page plus Thursday pages of a few packs with the box ticked (US Letter and A4, with a long name).
// Run: npx -y tsx scripts/render-pack-math.mts <outDir>
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { pageToSvg } from '../src/lib/render';
import { buildMathPage, packFindNumberPage } from '../src/lib/mathSheets';
import { PLANS, buildWeekPack } from '../src/lib/homeschool';
import type { Page } from '../src/lib/sheet';

const out = process.argv[2] ?? 'render-check';
await mkdir(out, { recursive: true });
const name = 'Maximiliano Alexander';
let n = 0;
async function save(page: Page, file: string, tag: string) {
  for (const it of page.items) {
    const xs = it.kind === 'line' ? [it.x1, it.x2] : it.kind === 'dot' ? [it.cx] : it.kind === 'text' ? [it.x] : [];
    const ys = it.kind === 'line' ? [it.y1, it.y2] : it.kind === 'dot' ? [it.cy] : it.kind === 'text' ? [it.y] : [];
    if (xs.some((x) => x < 20 || x > page.w - 20) || ys.some((y) => y < 20 || y > page.h - 18)) console.log('OUTSIDE', tag, JSON.stringify(it).slice(0, 120));
  }
  const svg = pageToSvg(page)
    .replace('width="100%"', `width="${page.w}" height="${page.h}"`)
    .replace(/font-family="[^"]*"/g, 'font-family="Helvetica, Arial, Liberation Sans, DejaVu Sans, sans-serif"');
  await writeFile(path.join(out, file), await sharp(Buffer.from(svg), { density: 110 }).flatten({ background: '#ffffff' }).png().toBuffer());
  n++;
}

// Every number 1 to 20 on both papers is checked for drawing off the page; a few are saved as images.
for (const paper of ['letter', 'a4'] as const) for (let k = 1; k <= 20; k++) {
  const page = buildMathPage({ kind: 'find-number', range: 20, number: k, compare: 'more', name, paper, credit: true, seed: 1, series: 'pre-k' });
  if ([1, 4, 10, 13, 20].includes(k)) await save(page, `find-${k}-${paper}.png`, `find ${k} ${paper}`);
  else for (const it of page.items) if (it.kind === 'dot' && (it.cy > page.h - 40)) console.log('LOW', k, paper);
}
// Packs with the extra page: the plan page and the last two pages of Thursday.
for (const wn of [1, 2, 20, 36]) for (const paper of ['letter', 'a4'] as const) {
  const week = PLANS['pre-k'].weeks[wn - 1];
  const pages = buildWeekPack({ level: 'pre-k', week, name, paper, credit: true, bubble: null, faith: wn === 20, extraMath: packFindNumberPage });
  const plain = buildWeekPack({ level: 'pre-k', week, name, paper, credit: true, bubble: null, faith: wn === 20 });
  if (pages.length !== plain.length + 1) console.log('PACK LENGTH', wn, paper, pages.length, plain.length);
  await save(pages[0], `pack-w${wn}-plan-${paper}.png`, `plan ${wn}`);
  const extra = pages.find((p) => p.items.some((it) => it.kind === 'text' && /^Find \d+$/.test(it.text)));
  if (!extra) console.log('NO EXTRA PAGE', wn, paper); else await save(extra, `pack-w${wn}-extra-${paper}.png`, `extra ${wn}`);
}
// Kindergarten packs ignore the option.
for (const week of PLANS.kindergarten.weeks) {
  const a = buildWeekPack({ level: 'kindergarten', week, name, paper: 'letter', credit: true, bubble: null, extraMath: packFindNumberPage });
  const b = buildWeekPack({ level: 'kindergarten', week, name, paper: 'letter', credit: true, bubble: null });
  if (a.length !== b.length) console.log('K PACK CHANGED', week.n);
}
console.log(`${n} renders in ${out}`);
