// Renders the plan page (and the picture book's last sheet) for the M5/M6 worst cases: faith on, 30 min a day,
// long names. Run: npx tsx scripts/qa/render-plan.mts <outdir>
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { pageToSvg, imagesIn, setSvgImageHref } from '../../src/lib/render';
import { loadThemeIcons, THEME_IDS } from '../../src/lib/program/themes';
import { setSceneArt } from '../../src/lib/program/story';
import { placeChild } from '../../src/lib/program/engine';
import { buildProgramWeek } from '../../src/lib/program/pages';
import { freeWeekContent, templateContentFor } from '../../src/lib/program/templates';
import type { ChildProfile } from '../../src/lib/program/types';

const ROOT = process.cwd(); const out = process.argv[2];
await mkdir(out, { recursive: true });
await loadThemeIcons(THEME_IDS, (u) => readFile(path.join(ROOT, 'public', u), 'utf8'));
setSceneArt(JSON.parse(await readFile('src/lib/program/sceneArt.json', 'utf8')));
const dataUri = new Map<string, string>(); setSvgImageHref((s) => dataUri.get(s) ?? s);
async function png(page: any, file: string) {
  for (const src of imagesIn([page])) if (!dataUri.has(src)) dataUri.set(src, `data:image/png;base64,${(await readFile(path.join(ROOT, 'public', src))).toString('base64')}`);
  const svg = pageToSvg(page).replace('width="100%"', `width="${page.w}" height="${page.h}"`).replace(/font-family="[^"]*"/g, 'font-family="Helvetica, Arial, Liberation Sans, DejaVu Sans, sans-serif"');
  await writeFile(file, await sharp(Buffer.from(svg), { density: 100 }).flatten({ background: '#ffffff' }).png().toBuffer());
}
for (const [name, tag] of [['Maximiliana Christabel', 'maxi'], ['WWWWWWWWWWWWWWWWWWWWWWWW', 'w24']] as const) for (const paper of ['letter', 'a4'] as const) {
  const profile: ChildProfile = { id: 'c_plan', ageYears: 4, skills: {}, interests: ['dinosaurs'], daysPerWeek: 5, minutesPerDay: 30, faith: true, createdAt: '' };
  const plan = placeChild(profile);
  for (const wk of [plan.weeks[0], plan.weeks[1]]) {
    const content = wk.index === 1 ? freeWeekContent('dinosaurs', 'pre-k') : templateContentFor(profile, wk);
    const pages = buildProgramWeek({ name, profile, week: wk, content, paper, credit: true, planLength: plan.weeks.length });
    await png(pages[0], path.join(out, `plan-${tag}-${paper}-w${wk.index}.png`));
    const book = pages.filter((p) => p.items.some((i: any) => i.kind === 'text' && i.text === 'The end'));
    if (book[0]) await png(book[0], path.join(out, `book-end-${tag}-${paper}-w${wk.index}.png`));
  }
}
console.log('done');
