// QA (M5): the plan page never runs into the footer or off the page, for long names, faith on, every pace, both
// papers and every theme, with the template note and a long (AI-length) note.
// Run: npx tsx scripts/qa/plan-geom.mts   (exit code 1 on problems)
import { readFile } from 'node:fs/promises';
import type { ChildProfile, ThemeId } from '../../src/lib/program/types';
import { THEME_IDS } from '../../src/lib/program/themes';
import { setSceneArt } from '../../src/lib/program/story';
import { placeChild } from '../../src/lib/program/engine';
import { templateContentFor, freeWeekContent } from '../../src/lib/program/templates';
import { buildProgramWeek } from '../../src/lib/program/pages';
import { M } from '../../src/lib/homeschool';

setSceneArt(JSON.parse(await readFile('src/lib/program/sceneArt.json', 'utf8')));
const textW = (t: string, size: number) => { let u = 0; for (const ch of t) u += /[il.,'!|:;]/.test(ch) ? 0.26 : /[mwMW]/.test(ch) ? 0.84 : /[A-Z]/.test(ch) ? 0.66 : ch === ' ' ? 0.28 : 0.53; return u * size; };
const names = ['Maximiliana Christabel', 'WWWWWWWWWWWWWWWWWWWWWWWW', 'Maximiliana-Christabel Wolfeschlegelsteinhausen', 'Bo', ''];
const longNote = {
  teaches: 'This week {{name}} works on the letters S and A and the sight words away, big and blue, with dinosaur pictures on every page so the practice feels like play. Math is counting up to 10 with ten frames.',
  why: 'Knowing the sound each letter makes is what lets many kids start sounding out short words. Saying the sound out loud while tracing helps it stick, and short daily practice usually works better than long sessions.',
  activities: ['Hide 10 toy dinosaurs around one room, then count them together as {{name}} finds each one, lining them up in a row by the door.', 'Stomp like a T-rex around the kitchen. With each stomp, {{name}} says a word that starts with /s/ or /a/, and you say one back.'],
};
const issues: string[] = []; let pages = 0; let minScale = 1;
for (const theme of THEME_IDS as ThemeId[]) for (const level of ['pre-k', 'kindergarten'] as const) for (const [days, mins] of [[5, 30], [4, 30], [3, 30], [5, 10]] as const) {
  const profile: ChildProfile = { id: `c_${theme}`, ageYears: level === 'pre-k' ? 4 : 5, skills: level === 'pre-k' ? {} : { 'letter-names': 'got-it', 'letter-sounds': 'got-it' }, interests: [theme], daysPerWeek: days, minutesPerDay: mins, faith: true, createdAt: '' };
  const plan = placeChild(profile);
  for (const wk of [plan.weeks[0], plan.weeks[1], plan.weeks[4]]) for (const note of ['template', 'long'] as const) for (const paper of ['letter', 'a4'] as const) for (const name of names) {
    const c0 = wk.index === 1 ? freeWeekContent(theme, level) : templateContentFor(profile, wk);
    const content = note === 'long' ? { ...c0, parentNote: longNote } : c0;
    const [pg] = buildProgramWeek({ name, profile, week: wk, content, paper, credit: true, planLength: plan.weeks.length });
    pages++;
    const footerY = pg.h - M + 14 - 8; // top of the 8 pt footer line
    const texts = pg.items.filter((i: any) => i.kind === 'text') as any[];
    const footer = texts.filter((t) => t.size === 8 && t.y > pg.h - M);
    const body = texts.filter((t) => !footer.includes(t));
    for (const t of body) {
      const w = textW(t.text, t.size);
      const left = t.align === 'center' ? t.x - w / 2 : t.align === 'right' ? t.x - w : t.x;
      if (t.y > footerY - 2) issues.push(`FOOTER ${theme} ${level} ${days}d${mins}m faith ${paper} "${name}" ${note} w${wk.index}: "${t.text.slice(0, 40)}" y=${t.y.toFixed(0)} footer=${footerY.toFixed(0)}`);
      if (left < M - 2 || left + w > pg.w - M + 4) issues.push(`EDGE ${theme} ${level} ${paper} "${name}" w${wk.index}: "${t.text.slice(0, 40)}" x=${left.toFixed(0)}..${(left + w).toFixed(0)} of ${pg.w}`);
    }
    const s = Math.min(...body.filter((t) => t.text === 'Away from the paper').map((t) => t.size / 12.5));
    if (Number.isFinite(s)) minScale = Math.min(minScale, s);
  }
}
console.log(`${pages} plan pages checked, ${issues.length} issues, smallest scale ${minScale.toFixed(2)}`);
console.log([...new Set(issues)].slice(0, 30).join('\n'));
if (issues.length) process.exitCode = 1;
