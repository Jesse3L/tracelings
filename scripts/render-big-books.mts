// Renders big picture books to PNG (and one PDF each) so the layout can be checked by eye, US Letter and A4.
// Run: npx tsx scripts/render-big-books.mts <outDir> [theme,theme,...]
// Art: reads src/lib/program/sceneArt.json and public/program/scenes/ by default. To test before the art is in,
// point ART_DIR at a folder holding sceneArt.json and program/scenes/<theme>/<id>.png (placeholders).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { pageToSvg, pagesToPdf, loadImages, imagesIn, setSvgImageHref } from '../src/lib/render';
import { loadThemeIcons, THEME_IDS } from '../src/lib/program/themes';
import { bigBookPages } from '../src/lib/program/pages';
import { setSceneArt, storyHasArt } from '../src/lib/program/story';
import { freeWeekContent, templateContentFor } from '../src/lib/program/templates';
import { placeChild } from '../src/lib/program/engine';
import type { ChildProfile, ThemeId } from '../src/lib/program/types';
import type { Page } from '../src/lib/sheet';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] ?? 'render-big-books';
const list = ((process.argv[3] ?? '').split(',').filter(Boolean) as ThemeId[]);
const themes = list.length ? list : THEME_IDS;
const NAME = process.env.NAME ?? 'Maximiliana Christabel';
const ART = process.env.ART_DIR ? path.resolve(process.env.ART_DIR) : path.join(ROOT, 'public');
const manifestFile = process.env.ART_DIR ? path.join(ART, 'sceneArt.json') : path.join(ROOT, 'src/lib/program/sceneArt.json');
if (!existsSync(manifestFile)) { console.log(`No manifest at ${manifestFile}: nothing has art yet.`); process.exit(0); }
setSceneArt(JSON.parse(await readFile(manifestFile, 'utf8')));
await mkdir(out, { recursive: true });
await loadThemeIcons(THEME_IDS, (u) => readFile(path.join(ROOT, 'public', u), 'utf8'));

const fileOf = (src: string) => path.join(ART, src);
const dataUri = new Map<string, string>();
setSvgImageHref((src) => dataUri.get(src) ?? src);

async function png(page: Page, file: string) {
  for (const it of page.items) {
    const xs = it.kind === 'line' ? [it.x1, it.x2] : it.kind === 'text' ? [it.x] : it.kind === 'image' ? [it.x, it.x + it.w] : [];
    const ys = it.kind === 'line' ? [it.y1, it.y2] : it.kind === 'text' ? [it.y] : it.kind === 'image' ? [it.y, it.y + it.h] : [];
    if (xs.some((x) => x < 4 || x > page.w - 4) || ys.some((y) => y < 4 || y > page.h - 1)) console.log('OUTSIDE', file, JSON.stringify(it).slice(0, 140));
  }
  for (const src of imagesIn([page])) if (!dataUri.has(src)) dataUri.set(src, `data:image/png;base64,${(await readFile(fileOf(src))).toString('base64')}`);
  const svg = pageToSvg(page).replace('width="100%"', `width="${page.w}" height="${page.h}"`)
    .replace(/font-family="[^"]*"/g, 'font-family="Helvetica, Arial, Liberation Sans, DejaVu Sans, sans-serif"');
  await writeFile(file, await sharp(Buffer.from(svg), { density: 110 }).flatten({ background: '#ffffff' }).png().toBuffer());
}

let n = 0;
for (const theme of themes) for (const level of ['pre-k', 'kindergarten'] as const) {
  // The free week 1 story, and a later template week (a word family or letter week) for variety.
  // A Kindergarten placement needs a 5 or 6 year old who knows letters and sounds.
  const profile: ChildProfile = { id: 'c_render', ageYears: level === 'pre-k' ? 4 : 6, skills: level === 'pre-k' ? {} : { 'letter-names': 'got-it', 'letter-sounds': 'got-it' }, interests: [theme], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '2026-10-16' };
  const plan = placeChild(profile);
  if (plan.level !== level) throw new Error(`render profile placed in ${plan.level}, wanted ${level}`);
  const later = plan.weeks[Math.min(plan.weeks.length - 1, 14)];
  const stories = [['week1', freeWeekContent(theme, level).story], [`week${later.index}`, templateContentFor(profile, later).story]] as const;
  for (const [tag, story] of stories) {
    if (!storyHasArt(theme, story)) { console.log(`${theme} ${level} ${tag}: no picture book (art missing)`); continue; }
    for (const paper of ['letter', 'a4'] as const) {
      const pages = bigBookPages({ name: NAME, theme, paper, credit: true, label: 'Week 1', seed: 'x' }, level, story);
      for (const [i, p] of pages.entries()) { await png(p, path.join(out, `${theme}-${level}-${tag}-${paper}-sheet${i + 1}.png`)); n++; }
      if (tag === 'week1') {
        await loadImages(imagesIn(pages), (u) => readFile(fileOf(u)));
        await writeFile(path.join(out, `${theme}-${level}-${paper}.pdf`), await pagesToPdf(pages, 'Picture book'));
      }
    }
  }
}
console.log(`${n} sheets in ${out}`);
