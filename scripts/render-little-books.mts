// Renders little books to PNG so the pictures can be checked against the words, US Letter and A4, a long name.
// Run: npx tsx scripts/render-little-books.mts <outDir> [theme,theme,...]
// For each theme it renders the free week 1 story (template) and the first hand-written fixture story
// (an AI-style story with no `icons`, so it shows the fallback matcher).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { pageToSvg } from '../src/lib/render';
import { loadThemeIcons, THEME_IDS } from '../src/lib/program/themes';
import { littleBookPage } from '../src/lib/program/pages';
import { freeWeekContent } from '../src/lib/program/templates';
import type { ThemeId, WeekContent } from '../src/lib/program/types';
import type { Page } from '../src/lib/sheet';
import { FIXTURES } from './story-fixtures.mts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] ?? 'render-little-books';
const themes = ((process.argv[3] ?? '').split(',').filter(Boolean) as ThemeId[]);
const list = themes.length ? themes : THEME_IDS;
const NAME = process.env.NAME ?? 'Maximiliana Christabel';
const FIX = Number(process.env.FIXTURE ?? 0);
await mkdir(out, { recursive: true });
await loadThemeIcons(THEME_IDS, (u) => readFile(path.join(ROOT, 'public', u), 'utf8'));

async function png(page: Page, file: string) {
  for (const it of page.items) {
    const xs = it.kind === 'line' ? [it.x1, it.x2] : it.kind === 'text' ? [it.x] : [];
    const ys = it.kind === 'line' ? [it.y1, it.y2] : it.kind === 'text' ? [it.y] : [];
    if (xs.some((x) => x < 4 || x > page.w - 4) || ys.some((y) => y < 4 || y > page.h - 2)) console.log('OUTSIDE', file, JSON.stringify(it).slice(0, 140));
  }
  const svg = pageToSvg(page).replace('width="100%"', `width="${page.w}" height="${page.h}"`)
    .replace(/font-family="[^"]*"/g, 'font-family="Helvetica, Arial, Liberation Sans, DejaVu Sans, sans-serif"');
  await writeFile(file, await sharp(Buffer.from(svg), { density: 110 }).flatten({ background: '#ffffff' }).png().toBuffer());
}

let n = 0;
for (const theme of list) {
  const stories: [string, WeekContent['story']][] = [
    ['free-pk', freeWeekContent(theme, 'pre-k').story],
    ['free-k', freeWeekContent(theme, 'kindergarten').story],
    [`fixture${FIX}`, FIXTURES[theme][FIX]],
  ];
  for (const [tag, story] of stories) for (const paper of ['letter', 'a4'] as const) {
    if (paper === 'a4' && tag === 'free-k') continue;
    const page = littleBookPage({ name: NAME, theme, paper, credit: true, label: 'Week 1', seed: 'x' }, story);
    await png(page, path.join(out, `${theme}-${tag}-${paper}.png`));
    n++;
  }
}
console.log(`${n} little books in ${out}`);
