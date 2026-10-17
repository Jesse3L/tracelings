import { readFile } from 'node:fs/promises';
import { THEME_IDS } from '../../src/lib/program/themes';
import { bigBookPages, bookSlot } from '../../src/lib/program/pages';
import { setSceneArt, readyPaths } from '../../src/lib/program/story';
import { sceneStoryFor } from '../../src/lib/program/templates';
import { PLANS } from '../../src/lib/homeschool';
import type { ThemeId } from '../../src/lib/program/types';
setSceneArt(JSON.parse(await readFile('src/lib/program/sceneArt.json', 'utf8')));
const textW = (t: string, size: number) => { let u = 0; for (const ch of t) u += /[il.,'!|:;]/.test(ch) ? 0.26 : /[mwMW]/.test(ch) ? 0.84 : /[A-Z]/.test(ch) ? 0.66 : ch === ' ' ? 0.28 : 0.53; return u * size; };
const names = ['Maximiliana Christabel', 'Bo', 'Maximiliana-Christabel Wolfeschlegelsteinhausen', 'WWWWWWWWWWWWWWWWWWWWWWWW', 'Wolfeschlegelsteinhausenb', ''];
const res: Record<string, any> = {}; let books = 0; const minSizes: Record<string, number> = {};
const issues = new Set<string>();
for (const theme of THEME_IDS as ThemeId[]) for (const level of ['pre-k', 'kindergarten'] as const) {
  const rp = readyPaths(theme, level);
  for (let k = 0; k < rp.length; k++) for (const [wi, w] of PLANS[level].weeks.entries()) {
    const story = sceneStoryFor(theme, level, w, { index: wi + 1, level, baseWeek: wi + 1, theme, focus: [] }, k)!;
    if (!story) { issues.add(`NO STORY ${theme} ${level} ${rp[k].id} w${wi+1}`); continue; }
    for (const p of story.pages) if (/\{W\}|\{\{/.test(p.replace('{{name}}',''))) issues.add(`placeholder left ${theme} ${rp[k].id}: ${p}`);
    for (const paper of ['letter', 'a4'] as const) for (const name of names) {
      const pages = bigBookPages({ name, theme, paper, credit: true, label: 'Week 1', seed: 'x' }, level, story);
      books++;
      const exp = level === 'pre-k' ? 2 : 3;
      if (pages.length !== exp) issues.add(`SHEETS ${theme} ${level} ${rp[k].id} ${pages.length}`);
      const W = pages[0].w, H = pages[0].h, pw = W / 2, ph = H / 2;
      for (const [si, pg] of pages.entries()) {
        const texts = pg.items.filter((it: any) => it.kind === 'text' && it.size >= 10) as any[];
        for (const t of texts) {
          const wpx = textW(t.text, t.size);
          const left = t.align === 'center' ? t.x - wpx / 2 : t.align === 'right' ? t.x - wpx : t.x;
          const right = left + wpx;
          // half it belongs to
          const half = t.x < pw ? 0 : 1; const strip = t.y < ph ? 0 : 1;
          const hx0 = half * pw, hy0 = strip * ph;
          if (left < hx0 + 8 || right > hx0 + pw - 8) issues.add(`HOVERFLOW ${theme} ${level} ${rp[k].id} ${paper} name=${name.length} s${si+1} size=${t.size} "${t.text}" w=${wpx.toFixed(0)} half=${pw.toFixed(0)}`);
          if (t.y > hy0 + ph - 18 && t.size > 10) issues.add(`VOVERFLOW ${theme} ${level} ${rp[k].id} ${paper} name=${name.length} s${si+1} "${t.text}" y=${(t.y-hy0).toFixed(0)}/${ph.toFixed(0)}`);
        }
        const big = texts.filter((t) => t.size >= 12 && t.text !== 'The end');
        for (const t of big) { const key = `${level}`; minSizes[key] = Math.min(minSizes[key] ?? 99, t.size); }
        // image overlaps text?
        const imgs = pg.items.filter((it: any) => it.kind === 'image') as any[];
        for (const im of imgs) for (const t of texts) {
          const wpx = textW(t.text, t.size); const left = t.align === 'center' ? t.x - wpx / 2 : t.x;
          if (t.x > im.x - 5 && t.x < im.x + im.w + 5 && t.y > im.y && t.y - t.size * 0.8 < im.y + im.h + 3) issues.add(`TEXT-ON-IMAGE ${theme} ${rp[k].id} ${paper} n=${name.length} s${si+1} "${t.text}"`);
        }
        // story text that reached minimum size (sign of shrink limit)
        for (const t of big) if ((level === 'pre-k' && t.size <= 15) || (level === 'kindergarten' && t.size <= 12)) if (!/^Well read|A story for/.test(t.text) && !(name && t.text.replace(/!$/, "") === name.charAt(0).toUpperCase() + name.slice(1).toLowerCase())) issues.add(`MIN-SIZE ${theme} ${level} ${rp[k].id} w${wi+1} ${paper} n=${name.length} s${si+1} size=${t.size} "${t.text}"`);
      }
      // page numbers: collect & assert assembly order
      for (let p = 1; p <= story.pages.length; p++) { const s = bookSlot(p); const pg = pages[s.sheet]; const nums = pg.items.filter((it: any) => it.kind === 'text' && it.text === String(p)); if (!nums.length) issues.add(`MISSING PAGE NUM ${p} ${theme} ${rp[k].id}`); }
    }
  }
}
console.log('books checked', books, 'min sizes', minSizes);
const arr = [...issues]; console.log(arr.length, 'issues'); const byKind: Record<string, number> = {}; for (const i of arr) byKind[i.split(' ')[0]] = (byKind[i.split(' ')[0]] ?? 0) + 1; console.log(byKind);
await (await import('node:fs/promises')).writeFile((process.env.OUT ?? '/tmp') + '/geom-issues.txt', arr.join('\n'));
