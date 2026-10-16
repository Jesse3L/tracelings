// Audit: does every little book picture match the words on its page?
// Run: npx tsx scripts/audit-story-pictures.mts   (exits 1 on any mismatch)
//
// Checks the little book decisions (littleBookPlan, the same code the PDF uses) for
//   - every template week: all 12 themes, both levels, every plan week for a spread of starting points, and
//   - 10 hand-written AI-style fixture stories per theme (scripts/story-fixtures.mts), which carry no `icons`,
//     so they go through the fallback matcher used for already-cached AI weeks.
// The check here is written separately from the matcher on purpose: it looks for the picture's names (one, many,
// words, or the buddy's name for the buddy picture) as whole words in the printed page text. A page with no
// picture is fine (it gets a "Draw it!" box); a picture whose name isn't on the page is a mismatch.
// It also counts what the old logic (pick an unused icon, else the next one) would have shown, for comparison.
import { THEMES, THEME_IDS, type ThemeIcon } from '../src/lib/program/themes';
import { littleBookPlan, personalize, problemIcon } from '../src/lib/program/pages';
import { placeChild } from '../src/lib/program/engine';
import { templateContentFor, freeWeekContent } from '../src/lib/program/templates';
import type { ChildProfile, ThemeId, WeekContent } from '../src/lib/program/types';
import { FIXTURES } from './story-fixtures.mts';

const NAME = 'Maximiliana Christabel';
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Independent check: a name of the picture appears as whole words (hyphen or space between parts is fine). */
function named(theme: ThemeId, id: string, text: string): boolean {
  const T = THEMES[theme];
  const ic = T.icons.find((i) => i.id === id);
  if (!ic) return false;
  const names = [ic.one, ic.many, ...(ic.words ?? [])];
  if (id === T.buddy.icon) names.push(T.buddy.one, T.buddy.one.replace(/^little /, ''));
  const low = text.toLowerCase().replace(/[’']s\b/g, '');
  return names.some((n) => new RegExp(`(^|[^a-z])${n.toLowerCase().split(/[\s-]+/).map(esc).join('[\\s-]+')}([^a-z]|$)`).test(low));
}

/** The old picking rule, kept here only to show how often it went wrong. */
function oldPics(theme: ThemeId, pages: string[]): string[] {
  const icons = THEMES[theme].icons;
  const used = new Set<string>();
  return pages.map((txt, i) => {
    if (txt.startsWith('DRAW:')) return '';
    const low = txt.toLowerCase();
    const hit = [...icons].sort((a, b) => b.one.length - a.one.length).find((ic) => !used.has(ic.id) && (low.includes(ic.one.toLowerCase()) || low.includes(ic.many.toLowerCase())));
    const pick: ThemeIcon = hit ?? icons.find((ic) => !used.has(ic.id)) ?? icons[(i * 3 + 1) % icons.length];
    used.add(pick.id);
    return pick.id;
  });
}

let books = 0, pagesChecked = 0, drawIt = 0, oldBad = 0, problems = 0;
const mismatches: string[] = [];
const seen = new Set<string>();

function audit(theme: ThemeId, story: WeekContent['story'], where: string) {
  const key = `${theme}|${JSON.stringify(story)}`;
  if (seen.has(key)) return;
  seen.add(key);
  books++;
  const { pages, pics } = littleBookPlan({ name: NAME, theme }, story);
  const old = oldPics(theme, pages);
  pages.forEach((p, i) => {
    if (p.startsWith('DRAW:')) return;
    pagesChecked++;
    const pic = pics[i];
    if (!pic) drawIt++;
    else if (!named(theme, pic, p)) mismatches.push(`${where} page ${i + 1}: [${pic}] "${p}"`);
    if (old[i] && !named(theme, old[i], p)) oldBad++;
  });
}

function auditProblems(theme: ThemeId, list: WeekContent['wordProblems'], where: string) {
  for (const q of list) {
    problems++;
    const ic = problemIcon(theme, q.text, q.icon, [q.a, q.b]);
    if (ic && !named(theme, ic.id, personalize(q.text, NAME))) mismatches.push(`${where} word problem: [${ic.id}] "${q.text}"`);
    if (q.icon && ic?.id !== q.icon) mismatches.push(`${where} word problem: template chose [${q.icon}] but the page shows [${ic?.id ?? 'circles'}]: "${q.text}"`);
  }
}

// 1. Template weeks: the 24 free week 1s, and every week of plans for a spread of children.
for (const theme of THEME_IDS) for (const level of ['pre-k', 'kindergarten'] as const) {
  const c = freeWeekContent(theme, level);
  audit(theme, c.story, `${theme} free ${level}`);
  auditProblems(theme, c.wordProblems, `${theme} free ${level}`);
}
const starts: Partial<ChildProfile>[] = [
  { ageYears: 3 }, { ageYears: 3, skills: { 'letter-names': 'learning' } }, { ageYears: 4, skills: { 'letter-names': 'got-it' } },
  { ageYears: 5 }, { ageYears: 5, skills: { 'letter-names': 'got-it' } },
  { ageYears: 6, skills: { 'letter-names': 'got-it', 'letter-sounds': 'got-it', blending: 'got-it', 'count-10': 'got-it', numerals: 'got-it' } },
  { ageYears: 6, skills: { 'letter-names': 'got-it', 'letter-sounds': 'got-it', blending: 'got-it', 'word-families': 'got-it', 'count-20': 'got-it', 'count-10': 'got-it', numerals: 'got-it', 'add-5': 'got-it' } },
];
let weeks = 0;
for (const theme of THEME_IDS) for (const s of starts) {
  const profile = { id: 'c_audit', ageYears: 4, skills: {}, interests: [theme], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '2026-10-16', ...s } as ChildProfile;
  for (const wk of placeChild(profile).weeks) {
    weeks++;
    const c = templateContentFor(profile, wk);
    audit(theme, c.story, `${theme} age ${profile.ageYears} week ${wk.index} (${wk.level} base ${wk.baseWeek})`);
    auditProblems(theme, c.wordProblems, `${theme} week ${wk.index}`);
  }
}
const templateBooks = books;

// 2. AI-style fixture stories with no icons (the fallback for cached AI weeks).
for (const theme of THEME_IDS) FIXTURES[theme].forEach((f, i) => audit(theme, f, `${theme} fixture ${i + 1} "${f.title}"`));

console.log(`template weeks: ${weeks} plan weeks + 24 free weeks, ${templateBooks} distinct little books`);
console.log(`fixtures: ${books - templateBooks} AI-style stories`);
console.log(`story pages checked: ${pagesChecked}; "Draw it!" pages (nothing pictured named): ${drawIt}; word problems checked: ${problems}`);
console.log(`old logic would have shown a picture the page doesn't name on ${oldBad} pages`);
console.log(`MISMATCHES: ${mismatches.length}`);
for (const m of mismatches.slice(0, 50)) console.log(`  ${m}`);
if (mismatches.length) process.exitCode = 1;
