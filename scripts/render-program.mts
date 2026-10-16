// Render check for the personalized program's pages: every themed page type, US Letter and A4, a long name,
// several themes and both levels. Writes PNGs so they can be looked at before merging.
// Run: npx tsx scripts/render-program.mts <outDir>
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { pageToSvg, imagesIn, setSvgImageHref } from '../src/lib/render';
import { setSceneArt } from '../src/lib/program/story';
import { loadFont } from '../src/lib/fontshape';
import { loadThemeIcons, THEME_IDS } from '../src/lib/program/themes';
import { placeChild } from '../src/lib/program/engine';
import { buildProgramWeek, showMePage } from '../src/lib/program/pages';
import { templateContentFor } from '../src/lib/program/templates';
import type { ChildProfile, ThemeId } from '../src/lib/program/types';
import type { Page } from '../src/lib/sheet';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] ?? 'render-program';
await mkdir(out, { recursive: true });
await loadThemeIcons(THEME_IDS, (u) => readFile(path.join(ROOT, 'public', u), 'utf8'));
const fetcher = async (u: string) => { const b = await readFile(path.join(ROOT, 'public', u)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };
const bubble = await loadFont('bubble', fetcher);
const NAME = process.env.NAME ?? 'Maximiliana Christabel';
// Picture book art: src/lib/program/sceneArt.json and public/ by default, or ART_DIR (sceneArt.json + program/scenes/).
const ART = process.env.ART_DIR ? path.resolve(process.env.ART_DIR) : path.join(ROOT, 'public');
try { setSceneArt(JSON.parse(await readFile(process.env.ART_DIR ? path.join(ART, 'sceneArt.json') : path.join(ROOT, 'src/lib/program/sceneArt.json'), 'utf8'))); } catch { setSceneArt({}); }
const dataUri = new Map<string, string>();
setSvgImageHref((src) => dataUri.get(src) ?? src);

async function png(page: Page, file: string) {
  // Anything drawn outside the page is a bug.
  for (const it of page.items) {
    const xs = it.kind === 'line' ? [it.x1, it.x2] : it.kind === 'dot' ? [it.cx] : it.kind === 'text' ? [it.x] : it.kind === 'image' ? [it.x, it.x + it.w] : [];
    const ys = it.kind === 'line' ? [it.y1, it.y2] : it.kind === 'dot' ? [it.cy] : it.kind === 'text' ? [it.y] : it.kind === 'image' ? [it.y, it.y + it.h] : [];
    if (xs.some((x) => x < 4 || x > page.w - 4) || ys.some((y) => y < 4 || y > page.h - 2)) console.log('OUTSIDE', file, JSON.stringify(it).slice(0, 140));
  }
  for (const src of imagesIn([page])) if (!dataUri.has(src)) dataUri.set(src, `data:image/png;base64,${(await readFile(path.join(ART, src))).toString('base64')}`);
  const svg = pageToSvg(page).replace('width="100%"', `width="${page.w}" height="${page.h}"`)
    .replace(/font-family="[^"]*"/g, 'font-family="Helvetica, Arial, Liberation Sans, DejaVu Sans, sans-serif"');
  await writeFile(file, await sharp(Buffer.from(svg), { density: 110 }).flatten({ background: '#ffffff' }).png().toBuffer());
}

const cases: { tag: string; p: Partial<ChildProfile>; weeks: number[] }[] = [
  { tag: 'pk-dino', p: { ageYears: 3, interests: ['dinosaurs'], faith: true }, weeks: [1, 2] },
  { tag: 'pk-unicorn', p: { ageYears: 4, interests: ['unicorns'], minutesPerDay: 30 }, weeks: [1, 5] },
  { tag: 'k-trucks', p: { ageYears: 5, interests: ['trucks'], skills: { 'letter-names': 'got-it' } }, weeks: [1, 3] },
  { tag: 'k-ocean', p: { ageYears: 5, interests: ['ocean'], skills: { 'letter-names': 'got-it', 'letter-sounds': 'got-it', 'count-10': 'got-it', numerals: 'got-it' } }, weeks: [1, 9] },
  { tag: 'pk-bugs-3day', p: { ageYears: 4, interests: ['bugs', 'castles'], daysPerWeek: 3, minutesPerDay: 30, faith: true, skills: { 'letter-names': 'learning' } }, weeks: [1, 10] },
  { tag: 'k-space', p: { ageYears: 6, interests: ['space'], minutesPerDay: 20, skills: { 'letter-names': 'got-it', 'letter-sounds': 'got-it', blending: 'got-it', 'word-families': 'got-it', 'count-20': 'got-it', numerals: 'got-it', 'count-10': 'got-it', 'add-5': 'got-it' } }, weeks: [1] },
];
const only = (process.env.THEMES ?? '').split(',').filter(Boolean) as ThemeId[];
let n = 0;
for (const c of cases) {
  const profile: ChildProfile = { id: `c_${c.tag}`, ageYears: 4, skills: {}, interests: ['dinosaurs'], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '2026-10-16', ...c.p } as ChildProfile;
  if (only.length && !profile.interests.some((t) => only.includes(t))) continue;
  const plan = placeChild(profile);
  for (const wi of c.weeks) {
    const week = plan.weeks[wi - 1];
    const content = templateContentFor(profile, week);
    for (const paper of ['letter', 'a4'] as const) {
      const pages = buildProgramWeek({ name: NAME, profile, week, content, paper, credit: true, bubble, planLength: plan.weeks.length });
      for (let i = 0; i < pages.length; i++) {
        if (paper === 'a4' && wi !== c.weeks[0]) continue;
        await png(pages[i], path.join(out, `${c.tag}-w${wi}-${paper}-p${String(i + 1).padStart(2, '0')}.png`));
        n++;
      }
    }
  }
}
for (const paper of ['letter', 'a4'] as const) { await png(showMePage(paper, 'farm'), path.join(out, `show-me-${paper}.png`)); n++; }
console.log(`${n} renders in ${out}`);
