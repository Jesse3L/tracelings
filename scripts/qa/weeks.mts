import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { pageToSvg, imagesIn, setSvgImageHref } from '../../src/lib/render';
import { setSceneArt } from '../../src/lib/program/story';
import { loadFont } from '../../src/lib/fontshape';
import { loadThemeIcons, THEME_IDS } from '../../src/lib/program/themes';
import { placeChild } from '../../src/lib/program/engine';
import { buildProgramWeek } from '../../src/lib/program/pages';
import { templateContentFor, freeWeekContent } from '../../src/lib/program/templates';
import type { ChildProfile, ThemeId } from '../../src/lib/program/types';
const ROOT = process.cwd(); const out = process.argv[2]; const RENDER = process.env.RENDER === '1';
await mkdir(out, { recursive: true });
await loadThemeIcons(THEME_IDS, (u) => readFile(path.join(ROOT, 'public', u), 'utf8'));
const fetcher = async (u: string) => { const b = await readFile(path.join(ROOT, 'public', u)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };
const bubble = await loadFont('bubble', fetcher);
setSceneArt(JSON.parse(await readFile('src/lib/program/sceneArt.json', 'utf8')));
const dataUri = new Map<string, string>(); setSvgImageHref((s) => dataUri.get(s) ?? s);
const issues: string[] = []; const log: string[] = [];
async function png(page: any, file: string) {
  for (const src of imagesIn([page])) if (!dataUri.has(src)) dataUri.set(src, `data:image/png;base64,${(await readFile(path.join(ROOT, 'public', src))).toString('base64')}`);
  const svg = pageToSvg(page).replace('width="100%"', `width="${page.w}" height="${page.h}"`).replace(/font-family="[^"]*"/g, 'font-family="Helvetica, Arial, Liberation Sans, DejaVu Sans, sans-serif"');
  await writeFile(file, await sharp(Buffer.from(svg), { density: 80 }).flatten({ background: '#ffffff' }).png().toBuffer());
}
const only = (process.env.THEMES ?? '').split(',').filter(Boolean);
const NAME = process.env.NAME ?? 'Maximiliana Christabel';
for (const theme of THEME_IDS as ThemeId[]) {
  if (only.length && !only.includes(theme)) continue;
  for (const level of ['pre-k', 'kindergarten'] as const) {
    for (const [days, mins, faith] of [[5, 15, true], [3, 30, false], [4, 10, false]] as const) {
      const profile: ChildProfile = { id: `c_${theme}`, ageYears: level === 'pre-k' ? 4 : 5, skills: level === 'pre-k' ? {} : (process.env.KLET ? { 'letter-names': 'got-it' } : { 'letter-names': 'got-it', 'letter-sounds': 'got-it' }), interests: [theme], daysPerWeek: days, minutesPerDay: mins, faith, createdAt: '2026-10-16' };
      const plan = placeChild(profile);
      const pick = (pred: (w: any, b: any) => boolean) => plan.weeks.find((w) => pred(w, (require as any) ? null : null));
      const { PLANS } = await import('../../src/lib/homeschool');
      const kindOf = (w: any) => PLANS[w.level].weeks[w.baseWeek - 1];
      const want: Record<string, any> = { w1: plan.weeks[0] };
      want.letter = plan.weeks.find((w) => kindOf(w).kind === 'letter' && w.index > 1);
      want.review = plan.weeks.find((w) => (kindOf(w).kind === 'review' || kindOf(w).kind === 'vowel-review' || w.extraReview) && w.index > 1);
      want.family = plan.weeks.find((w) => kindOf(w).kind === 'family');
      want.add = plan.weeks.find((w) => (w.math ? w.math.addTo : kindOf(w).addTo));
      for (const [tag, wk] of Object.entries(want)) {
        if (!wk) { log.push(`${theme} ${level} no ${tag} week`); continue; }
        const content = wk.index === 1 ? freeWeekContent(theme, level) : templateContentFor(profile, wk);
        for (const paper of ['letter', 'a4'] as const) {
          const pages = buildProgramWeek({ name: NAME, profile, week: wk, content, paper, credit: true, bubble, planLength: plan.weeks.length });
          const key = `${theme}-${level}-${days}d${mins}m${faith ? 'F' : ''}-${tag}-w${wk.index}-${paper}`;
          log.push(`${key}: ${pages.length} pages; story=${content.story.pathId ?? 'littlebook'}; math=${JSON.stringify(wk.math ?? {})}; base=${kindOf(wk).title}; problems=${content.wordProblems.map((p) => `${p.a}${p.op}${p.b}=${p.answer}[${p.icon ?? '-'}]`).join(' ')}; sentence="${content.tracingSentence}"`);
          for (const [i, p] of pages.entries()) {
            for (const it of p.items as any[]) {
              const xs = it.kind === 'line' ? [it.x1, it.x2] : it.kind === 'text' ? [it.x] : it.kind === 'image' ? [it.x, it.x + it.w] : [];
              const ys = it.kind === 'line' ? [it.y1, it.y2] : it.kind === 'text' ? [it.y] : it.kind === 'image' ? [it.y, it.y + it.h] : [];
              if (xs.some((x: number) => x < 4 || x > p.w - 4) || ys.some((y: number) => y < 4 || y > p.h - 2)) issues.push(`OUTSIDE ${key} p${i + 1} ${JSON.stringify(it).slice(0, 120)}`);
            }
            if (RENDER && paper === (process.env.PAPER ?? 'letter') && (days === 5 || process.env.ALLPACE)) await png(p, path.join(out, `${key}-p${String(i + 1).padStart(2, '0')}.png`));
          }
        }
      }
    }
  }
}
await writeFile(path.join(out, `log-${only.join('_') || 'all'}.txt`), log.join('\n'));
await writeFile(path.join(out, `issues-${only.join('_') || 'all'}.txt`), issues.join('\n'));
console.log(log.length, 'packs', issues.length, 'issues');
