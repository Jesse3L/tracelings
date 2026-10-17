// QA probe: prints a few placement plans, week by week (* = extra review week).
// Run: npx tsx scripts/qa/probe-plans.mts
import { placeChild, weekTitle } from '../../src/lib/program/engine';
import type { ChildProfile, SkillId } from '../../src/lib/program/types';
const ALL: SkillId[] = ['name-writing', 'letter-names', 'letter-sounds', 'blending', 'word-families', 'sight-words', 'count-10', 'count-20', 'numerals', 'compare', 'add-5', 'add-10'];
const p = (x: Partial<ChildProfile>): ChildProfile => ({ id: 'c_probe1', ageYears: 4, skills: {}, interests: ['dinosaurs'], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '2026-10-16', ...x });
const cases: [string, ChildProfile][] = [
  ['6yo reader', p({ ageYears: 6, skills: { 'name-writing': 'got-it', 'letter-names': 'got-it', 'letter-sounds': 'got-it', blending: 'got-it', 'word-families': 'got-it', 'sight-words': 'learning', 'count-20': 'got-it', numerals: 'got-it', 'count-10': 'got-it', 'add-5': 'got-it' } })],
  ['3yo got-it everything', p({ ageYears: 3, skills: Object.fromEntries(ALL.map((s) => [s, 'got-it'])) })],
  ['4yo knows letters+sounds', p({ ageYears: 4, skills: { 'letter-names': 'got-it', 'letter-sounds': 'got-it' } })],
  ['5yo learning', p({ ageYears: 5, skills: { 'letter-names': 'learning', 'letter-sounds': 'learning', 'word-families': 'learning' } })],
  ['4yo learning letters', p({ ageYears: 4, skills: { 'letter-names': 'learning' } })],
];
for (const [label, prof] of cases) {
  const pl = placeChild(prof);
  console.log(`${label}: ${pl.level} ${pl.weeks.length} weeks, ${pl.weeks.filter((w) => w.extraReview).length} extra reviews\n  ${pl.weeks.map((w) => weekTitle(w) + (w.extraReview ? '*' : '')).join(' | ')}`);
}
