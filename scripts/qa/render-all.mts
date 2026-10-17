import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { pageToSvg, imagesIn, setSvgImageHref } from '../../src/lib/render';
import { loadThemeIcons, THEME_IDS } from '../../src/lib/program/themes';
import { bigBookPages, bigBookPlan, bookSlot } from '../../src/lib/program/pages';
import { setSceneArt, readyPaths, storyHasArt } from '../../src/lib/program/story';
import { sceneStoryFor } from '../../src/lib/program/templates';
import { PLANS } from '../../src/lib/homeschool';
import type { ThemeId } from '../../src/lib/program/types';
import type { Page } from '../../src/lib/sheet';
const ROOT = process.cwd();
const out = process.argv[2];
const papers = (process.env.PAPERS ?? 'letter,a4').split(',');
const names = (process.env.NAMES ?? 'Maximiliana Christabel|Bo').split('|');
setSceneArt(JSON.parse(await readFile('src/lib/program/sceneArt.json', 'utf8')));
await mkdir(out, { recursive: true });
await loadThemeIcons(THEME_IDS, (u) => readFile(path.join(ROOT, 'public', u), 'utf8'));
const dataUri = new Map<string, string>();
setSvgImageHref((src) => dataUri.get(src) ?? src);
const issues: string[] = [];
async function png(page: Page, file: string) {
  for (const it of page.items) {
    const xs = it.kind === 'line' ? [it.x1, it.x2] : it.kind === 'text' ? [it.x] : it.kind === 'image' ? [it.x, it.x + it.w] : [];
    const ys = it.kind === 'line' ? [it.y1, it.y2] : it.kind === 'text' ? [it.y] : it.kind === 'image' ? [it.y, it.y + it.h] : [];
    if (xs.some((x) => x < 4 || x > page.w - 4) || ys.some((y) => y < 4 || y > page.h - 1)) issues.push('OUTSIDE ' + file + ' ' + JSON.stringify(it).slice(0, 140));
  }
  for (const src of imagesIn([page])) if (!dataUri.has(src)) dataUri.set(src, `data:image/png;base64,${(await readFile(path.join(ROOT, 'public', src))).toString('base64')}`);
  const svg = pageToSvg(page).replace('width="100%"', `width="${page.w}" height="${page.h}"`).replace(/font-family="[^"]*"/g, 'font-family="Helvetica, Arial, Liberation Sans, DejaVu Sans, sans-serif"');
  await writeFile(file, await sharp(Buffer.from(svg), { density: 100 }).flatten({ background: '#ffffff' }).png().toBuffer());
}
const only = (process.env.THEMES ?? '').split(',').filter(Boolean);
let total = 0; const summary: any[] = [];
for (const theme of THEME_IDS as ThemeId[]) {
  if (only.length && !only.includes(theme)) continue;
  for (const level of ['pre-k', 'kindergarten'] as const) {
    const rp = readyPaths(theme, level);
    const w = PLANS[level].weeks[0];
    for (let k = 0; k < rp.length; k++) {
      const story = sceneStoryFor(theme, level, w, { index: 1, level, baseWeek: 1, theme, focus: [] }, k)!;
      summary.push({ theme, level, path: rp[k].id, catalog: rp[k].scenes.length, fitted: story.scenes, dropped: rp[k].scenes.filter((x) => !story.scenes!.includes(x)), hasArt: storyHasArt(theme, story), pages: story.pages });
      for (const paper of papers) for (const name of names) {
        const pages = bigBookPages({ name, theme, paper: paper as any, credit: true, label: 'Week 1', seed: 'x' }, level, story);
        const tag = name.length > 3 ? 'long' : 'short';
        for (const [i, p] of pages.entries()) { await png(p, path.join(out, `${theme}-${level}-${rp[k].id}-${paper}-${tag}-s${i + 1}.png`)); total++; }
        // text item min size and overlap check
        for (const [i, p] of pages.entries()) for (const it of p.items) if (it.kind === 'text' && it.size < 12 && it.color === undefined) issues.push(`small ${theme} ${rp[k].id} ${paper} ${tag} s${i+1} ${it.size} ${it.text}`);
      }
    }
  }
}
await writeFile(path.join(out, 'summary-'+(only.join('_')||'all')+'.json'), JSON.stringify(summary, null, 1));
await writeFile(path.join(out, 'issues-'+(only.join('_')||'all')+'.txt'), issues.join('\n'));
console.log(total, 'pngs;', summary.length, 'paths;', issues.length, 'issues');
