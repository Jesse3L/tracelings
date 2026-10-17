// QA: every template word problem and tracing sentence across real plans. Prints anything that reads wrong.
// Run: npx tsx scripts/qa/probs.mts   (exit code 1 on problems)
import { THEME_IDS, THEMES, countedIcon, mentionsIcon, iconKind } from '../../src/lib/program/themes';
import { placeChild } from '../../src/lib/program/engine';
import { templateContentFor, freeWeekContent } from '../../src/lib/program/templates';
import { problemIcon } from '../../src/lib/program/pages';
import type { ChildProfile, ThemeId } from '../../src/lib/program/types';

const seen = new Set<string>(); const bad: string[] = []; const sents = new Map<string, Set<string>>();
for (const theme of THEME_IDS as ThemeId[]) for (const age of [3, 4, 5, 6] as const) for (const skills of [{}, { 'letter-names': 'got-it', 'letter-sounds': 'got-it' }, { 'count-10': 'got-it', numerals: 'got-it', 'count-20': 'got-it' }] as any[]) {
  const p: ChildProfile = { id: 'c', ageYears: age, skills, interests: [theme], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '' };
  const plan = placeChild(p);
  for (const w of plan.weeks) {
    const c = w.index === 1 ? freeWeekContent(theme, w.level) : templateContentFor(p, w);
    const key = `${theme}|${w.level}`;
    if (!sents.has(key)) sents.set(key, new Set());
    sents.get(key)!.add(c.tracingSentence);
    for (const q of c.wordProblems) {
      const k = theme + q.text + q.a + q.b; if (seen.has(k)) continue; seen.add(k);
      const nums = (q.text.match(/\d+/g) ?? []).map(Number);
      const ans = q.op === '+' ? q.a + q.b : q.op === '-' ? q.a - q.b : Math.max(q.a, q.b);
      const ic = problemIcon(theme, q.text, q.icon, [q.a, q.b]);
      if (ans !== q.answer) bad.push(`ANSWER ${theme} ${q.text} ${q.answer}`);
      if (!nums.includes(q.a) || !nums.includes(q.b)) bad.push(`NUMS ${theme} ${q.text} a=${q.a} b=${q.b}`);
      if (nums.some((n) => n !== q.a && n !== q.b)) bad.push(`EXTRA-NUM ${theme} ${q.text}`);
      if (q.op === '-' && /how many .* (in all|now)\?/i.test(q.text)) bad.push(`SUB-WORDING ${theme} ${q.text}`);
      if (q.op === '+' && /left\?/i.test(q.text)) bad.push(`ADD-WORDING ${theme} ${q.text}`);
      if (!ic) bad.push(`NO-PIC ${theme} ${q.text}`);
      else if (!mentionsIcon(theme, q.text, ic.id)) bad.push(`PIC-NOT-NAMED ${theme} [${ic.id}] ${q.text}`);
      // Silly verbs: places taken away, objects that play or nap, giving footprints away.
      if (q.icon && q.op === '-' && iconKind(theme, q.icon) === 'place') bad.push(`PLACE-TAKEN-AWAY ${theme} [${q.icon}] ${q.text}`);
      if (q.icon && iconKind(theme, q.icon) === 'object' && /\b(are playing|go home|goes home|nap|wait)\b/i.test(q.text)) bad.push(`OBJECT-ACTS ${theme} [${q.icon}] ${q.text}`);
      if (q.icon && iconKind(theme, q.icon) !== 'object' && /\bgives?\b/i.test(q.text)) bad.push(`GIVES-NON-OBJECT ${theme} [${q.icon}] ${q.text}`);
      void countedIcon;
    }
  }
}
console.log(seen.size, 'problems');
console.log(bad.join('\n') || 'no problem issues');
console.log('\nTRACING SENTENCES (distinct per theme and level)');
for (const [k, v] of sents) console.log(k, v.size, [...v].slice(0, 6).join(' | '));
if (bad.length) process.exitCode = 1;
void THEMES;
