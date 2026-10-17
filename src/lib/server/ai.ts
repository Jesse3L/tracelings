// AI content for one child-week of the personalized program (server only).
// Calls the Anthropic Messages API with fetch (env ANTHROPIC_API_KEY, model PROGRAM_AI_MODEL). Everything the model
// returns is checked in code; word problem answers are always recomputed here. When the key is missing, the call fails,
// times out, or the output fails validation twice, the parent gets the themed template instead. Never an error.
// The child's name is never sent: the model writes the literal placeholder {{name}}, and the browser swaps it in.
import type { ChildProfile, ProgramWeek, ThemeId, WeekContent } from '../program/types';
import { templateContentFor } from '../program/templates';
import { THEMES, mentionsIcon, countedIcon } from '../program/themes';
import { SCENES, sceneById, type Scene } from '../program/scenes';
import { BOOK_PAGES, arcProblem, castTerms, pickPath, readyPaths, pageLengthProblem, pageRuleText, sceneArt } from '../program/story';
import { PROPER_NAMES } from './properNames';
import { PLANS as BASE_PLANS, FAMILIES, type Level, type Week } from '../homeschool';

const env = (k: string): string | undefined => ((import.meta.env ?? {}) as Record<string, string | undefined>)[k] ?? process.env[k];

/** Word problems, tracing sentence and parent note (and the old little book story when a theme has no scene art). */
export const PROGRAM_AI_MODEL = env('PROGRAM_AI_MODEL') || 'claude-haiku-5-5';
/** The picture book story: a better writer, one call per child-week. */
export const PROGRAM_STORY_MODEL = env('PROGRAM_STORY_MODEL') || 'claude-sonnet-5-5';
const API_URL = env('ANTHROPIC_BASE_URL') ? `${env('ANTHROPIC_BASE_URL')}/v1/messages` : 'https://api.anthropic.com/v1/messages';
export const AI_TIMEOUT_MS = 15_000;
/** The picture book call thinks a little before writing, so it gets longer. */
export const STORY_TIMEOUT_MS = 45_000;
const STORY_EFFORT = env('PROGRAM_STORY_EFFORT') || 'medium';
export const aiConfigured = () => Boolean(env('ANTHROPIC_API_KEY'));

// ---------- What the week teaches ----------

export interface WeekFacts {
  level: ProgramWeek['level'];
  base: Week;
  theme: string;           // theme id
  themeLabel: string;      // "dinosaurs"
  themeWords: string[];
  /** The theme's picture ids with what each one shows ("t-rex" = "T-rex"), so a word problem can name its picture. */
  icons: { id: string; one: string; many: string }[];
  buddy: string;           // "little T-rex": the friendly character in stories and problems
  place: string;           // "in dinosaur land"
  /** The week's math step from the plan's math track (ProgramWeek.math), or the base week's. */
  math: { number?: number; addTo?: 5 | 10 };
  letters: string[];
  family?: string;
  familyWords: string[];
  sightWords: string[];
  mathMax: number;         // every number in a word problem stays within 0..mathMax
  ops: ('+' | '-' | 'compare')[];
  focus: string[];
  ageYears: number;
  extraReview: boolean;
}

/** Theme label, words and pictures from themes.ts. */
export function themeInfo(id: string): { label: string; words: string[]; icons: WeekFacts['icons']; buddy: string; place: string } {
  const t = THEMES[id as keyof typeof THEMES];
  if (!t) throw new Error(`unknown theme ${id}`);
  const words = [...new Set([...t.nouns, ...t.cvc, ...t.icons.map((i) => i.one)])].filter((w) => w.length > 0 && w.length < 24).slice(0, 24);
  return { label: t.short.toLowerCase(), words, icons: t.icons.map(({ id: i, one, many }) => ({ id: i, one, many })), buddy: t.buddy.one, place: t.place };
}

export function weekFacts(profile: ChildProfile, week: ProgramWeek): WeekFacts {
  const base = BASE_PLANS[week.level].weeks[week.baseWeek - 1];
  const { label, words, icons, buddy, place } = themeInfo(week.theme);
  const familyWords = base.family ? FAMILIES[base.family] ?? [] : (base.families ?? []).flatMap((f) => (FAMILIES[f] ?? []).slice(0, 2));
  // The plan's own math track wins (a child who counts to 20 isn't held to "the number 3" on an early letter week).
  const math: WeekFacts['math'] = week.math ?? (base.addTo ? { addTo: base.addTo } : { number: base.number || 1 });
  let mathMax: number;
  let ops: WeekFacts['ops'];
  if (math.addTo) { mathMax = math.addTo; ops = week.level === 'kindergarten' ? ['+', '-', 'compare'] : ['+', 'compare']; }
  else if (week.level === 'pre-k') { mathMax = Math.min(5, Math.max(3, (math.number ?? 1) + 1)); ops = ['+', 'compare']; }
  else { mathMax = Math.min(10, Math.max(5, math.number ?? 5)); ops = (math.number ?? 0) >= 5 ? ['+', '-', 'compare'] : ['+', 'compare']; }
  return {
    level: week.level, base, theme: week.theme, themeLabel: label, themeWords: words, icons, buddy, place, math,
    letters: base.letters ?? [], family: base.family, familyWords, sightWords: base.sightWords ?? [],
    mathMax, ops, focus: week.focus, ageYears: profile.ageYears, extraReview: Boolean(week.extraReview),
  };
}

// ---------- Content rules (from docs/content-guide.md, plus safety rules for a story about a child) ----------

export const BANNED = [
  'unlock', 'seamless', 'seamlessly', 'elevate', 'dive in', 'dive into', 'deep dive', "whether you're", 'whether you are',
  "in today's world", 'game-changer', 'game changer', "it's important to note", 'it is important to note',
  'look no further', 'in this article', 'without further ado', 'navigate', 'journey', 'ultimate guide',
];
const SCARY = ['kill', 'killed', 'dead', 'death', 'die', 'died', 'dying', 'blood', 'bloody', 'gun', 'guns', 'knife', 'sword', 'weapon', 'hurt', 'hurts', 'injured', 'bleed', 'ghost', 'ghosts', 'nightmare', 'scary', 'terrified', 'eat you', 'eaten', 'lost forever', 'kidnap', 'stranger', 'burn', 'burned', 'poison', 'drown', 'hate', 'stupid', 'dumb', 'shut up'];
const FAITH = ['god', 'jesus', 'christ', 'lord', 'pray', 'prayer', 'prayed', 'church', 'bible', 'heaven', 'angel', 'angels', 'bless', 'blessed', 'amen', 'sin', 'devil', 'allah', 'temple', 'mosque', 'synagogue', 'christmas', 'easter', 'hanukkah', 'santa'];
// Common first names: the model must never invent one. (Capitalized mid-sentence words are checked separately.)
// Words that are also everyday words (rose, daisy, river, autumn, miles) are left out so they can be used.
const FIRST_NAMES = new Set(('liam noah oliver james elijah william henry lucas benjamin theodore mateo levi sebastian daniel jack michael alexander owen asher samuel ethan leo jackson mason ezra john hudson luca aiden joseph david jacob logan luke julian gabriel grayson wyatt matthew maverick dylan isaac elias anthony thomas jayden carter santiago ezekiel charles josiah caleb cooper lincoln christopher nathan isaiah kai joshua andrew adrian cameron nolan waylon jaxon roman eli wesley aaron ian christian ryan leonardo axel jonathan easton everett weston bennett robert jameson landon silas jose beau micah colton jordan jeremiah parker greyson rowan adam nicholas theo xavier dominic jace gael thiago kayden damian zachary sam max ben tom tim bob ted ned ollie finn milo jake '
  + 'olivia emma charlotte amelia sophia mia isabella ava evelyn harper sofia scarlett elizabeth eleanor emily chloe mila violet penelope gianna aria abigail ella avery nora layla lily ellie madison isla zoe riley eliana victoria emilia zoey naomi hannah lucy elena lillian maya leah paisley addison natalie valentina everly delilah leilani madelyn kinsley sophie alice claire audrey sadie aaliyah josephine brooklyn quinn kennedy cora savannah caroline athena natalia hailey aubrey emery anna bella eloise skylar gabriella ariana maria adeline lydia sarah nevaeh liliana ayla everleigh raelynn allison madeline vivian kaylee lucia jane ana sue ann kim kate meg pam jill jen amy beth molly lola kay').split(' ').filter(Boolean));
// Capitalized words that are fine in the middle of a sentence.
const OK_CAPS = new Set(['I', 'Mom', 'Dad', 'Mommy', 'Daddy', 'Mama', 'Papa', 'Grandma', 'Grandpa', 'Nana', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'Earth', 'Moon', 'Sun', 'Mars', 'Venus', 'Jupiter', 'Saturn', 'Mercury', 'Neptune', 'Uranus', 'T', 'Rex', 'OK', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'U', 'V', 'W', 'X', 'Y', 'Z']);

const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const BIG_NUM_WORDS = /\b(thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|dozen)\b/i;

/** The word problem, tracing sentence and parent note rules, shared by both prompts. */
const REST_PARTS = [
  '- wordProblems: 4 to 6 short problems about the theme, each one or two sentences read aloud by the grown-up. Use only the numbers allowed for the week. Each problem lists a, b, op, an answer, and icon (the id of the picture the child counts). op "+" means a plus b. op "-" means a minus b, with a at least b. op "compare" asks which number is more, with a and b different; the answer is the bigger number. Write a and b as digits in the text. Do not put the answer in the text. Do not use any other numbers.',
  '- tracingSentence: one short sentence for the child to trace, 3 to 7 words and at most 36 letters, about the theme. It may use {{name}}. Letters, spaces, one hyphen inside a word (T-rex) and a final period or exclamation mark only.',
  '- parentNote: written to the grown-up. teaches: one or two sentences on what this week teaches. why: one or two sentences on why it helps right now. activities: exactly 2 off-paper activity ideas tied to the theme, each one sentence, using things most homes have. Do not talk to the child here.',
];

function systemPrompt(): string {
  return [
    'You write short, warm printable content for Tracelings, a site of worksheets for kids ages 3 to 7. A parent prints it and reads it with their child.',
    'Return only JSON that matches the schema. Every field is plain text with no markdown.',
    '',
    'The child:',
    '- Always refer to the child with the exact placeholder {{name}} (two curly braces, the word name). The browser replaces it with the real name later.',
    '- Never invent a name for anyone. Other characters are described, not named: "a little dinosaur", "Mom", "a friendly truck driver". No pet names either.',
    '- Write about the child in the third person in the story ("{{name}} sees a big truck"). Do not use "you" in the story.',
    '',
    'House style (follow every rule):',
    '- Warm, calm and simple. Short sentences. Plain words.',
    '- No em dashes and no en dashes. Do not use a hyphen as a dash between words with spaces. Use a period or a comma instead. Write number ranges as "1 to 5".',
    '- Never use these words or phrases: unlock, seamless, seamlessly, elevate, dive in, dive into, deep dive, "whether you\'re", "in today\'s world", game-changer, "it\'s important to note", "look no further", "in this article", "without further ado", navigate, journey, "the ultimate guide".',
    '- No invented statistics, studies, quotes or experts. No personal anecdotes.',
    '- Never shame a child or a parent. Never create worry. Kids learn at different speeds.',
    '- Use soft words about learning: many kids, often, usually. Avoid "should be able to", "must", "always".',
    '- Nothing scary or unkind: no danger, injury, fighting, weapons, monsters, ghosts, getting lost, fire, or being eaten. Dinosaurs and sharks are friendly.',
    '- Faith neutral: no God, prayer, church, Bible, angels, or religious holidays. (A Bible verse is added separately when a family wants one.)',
    '- No brand names, licensed characters, or real people.',
    '',
    'The parts:',
    '- story: a little book. A short title (2 to 6 words) and 4 to 8 pages. Each page is 1 or 2 short sentences, at most 12 words per sentence. {{name}} is the star and appears on at least two pages. Lean on decodable words for the level: the week\'s letters, word family words and sight words, plus the theme words. Avoid long or tricky words. A gentle, happy ending.',
    '- story.icons: the little book has one picture per page, and only the pictures in the list you are given exist. Every page is about one pictured thing from that list and names it in the words of that page ("The T-rex sat in the mud.", not "It sat in the mud."). icons has one entry per page, in the same order as pages: the id of the picture that page names. The same picture may be used on more than one page. Do not build a page around something that has no picture.',
    ...REST_PARTS,
  ].join('\n');
}

function userPrompt(f: WeekFacts): string {
  return [...weekLines(f, true), ...mathLines(f), ...storyLines(f)].join('\n');
}

/** The level, week and teaching lines. story=false leaves out the story-only asks (the picture book prompt has its own). */
function weekLines(f: WeekFacts, story: boolean): string[] {
  const lines = [
    `Level: ${f.level === 'pre-k' ? 'Pre-K' : 'Kindergarten'}. Age: ${f.ageYears}.`,
    `This week: ${f.base.title}${f.extraReview ? ' (an extra review week, so keep it gentle and familiar)' : ''}.`,
    `Theme: ${f.themeLabel}.${f.themeWords.length ? ` Theme words you can use: ${f.themeWords.join(', ')}.` : ''}`,
  ];
  if (story) {
    if (f.letters.length) lines.push(`Letters in focus: ${f.letters.join(', ')}. Use several words that start with ${f.letters.length > 1 ? 'each of these letters' : 'this letter'} in the story.`);
    if (f.family) lines.push(`Word family: -${f.family}. Use at least 2 of these words in the story: ${f.familyWords.join(', ')}.`);
    else if (f.familyWords.length) lines.push(`Word families to review: ${f.familyWords.join(', ')}. Use at least 2 of them in the story.`);
    if (f.sightWords.length) lines.push(`Sight words this week: ${f.sightWords.join(', ')}. Use each one in the story.`);
    if (f.base.kind === 'name') lines.push('This is the name week, so the story can be about {{name}} and the letters in their name.');
  }
  lines.push(`Skills in focus: ${f.focus.join(', ') || 'general review'}.`);
  return lines;
}

function mathLines(f: WeekFacts): string[] {
  const lines: string[] = [];
  lines.push(`Math this week: ${f.math.addTo ? `adding within ${f.math.addTo}` : `the number ${f.math.number}`}.`);
  lines.push(`Word problems: every number is a whole number from 1 to ${f.mathMax}, and every answer is at most ${f.mathMax}. Allowed op values: ${f.ops.map((o) => `"${o}"`).join(', ')}.`);
  lines.push(`Each word problem counts one kind of thing that has a picture. Set icon to its id, and write its name right after the numbers ("3 eggs", "2 more eggs"). Pictures (id: name): ${f.icons.map((i) => `${i.id}: ${i.one} (${i.many})`).join('; ')}.`);
  return lines;
}

function storyLines(f: WeekFacts): string[] {
  return [
    `Story pictures (id: name): ${f.icons.map((i) => `${i.id}: ${i.one}`).join('; ')}. Each story page names one of these things, and story.icons[i] is its id. Nothing else has a picture.`,
    `The friendly character can be the ${f.buddy}. Stories can happen ${f.place}.`,
    f.level === 'pre-k'
      ? 'Keep the story very simple: mostly 3 and 4 letter words, about 40 to 90 words in all.'
      : 'Keep the story simple: mostly short words, about 60 to 140 words in all.',
  ];
}

export const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    story: { type: 'object', properties: { title: { type: 'string' }, pages: { type: 'array', items: { type: 'string' }, minItems: 1 }, icons: { type: 'array', items: { type: 'string' } } }, required: ['title', 'pages', 'icons'], additionalProperties: false },
    wordProblems: { type: 'array', minItems: 1, items: { type: 'object', properties: {
      text: { type: 'string' }, a: { type: 'integer' }, b: { type: 'integer' }, op: { type: 'string', enum: ['+', '-', 'compare'] }, answer: { type: 'integer' }, icon: { type: 'string' },
    }, required: ['text', 'a', 'b', 'op', 'answer', 'icon'], additionalProperties: false } },
    tracingSentence: { type: 'string' },
    parentNote: { type: 'object', properties: { teaches: { type: 'string' }, why: { type: 'string' }, activities: { type: 'array', items: { type: 'string' } } }, required: ['teaches', 'why', 'activities'], additionalProperties: false },
  },
  required: ['story', 'wordProblems', 'tracingSentence', 'parentNote'],
  additionalProperties: false,
} as const;

// ---------- Validation ----------

export class ContentInvalid extends Error {}
const fail = (why: string): never => { throw new ContentInvalid(why); };

const tidy = (s: unknown, max: number, what: string): string => {
  if (typeof s !== 'string') fail(`${what}: not text`);
  const t = (s as string).replace(/\s+/g, ' ').replace(/\{\{\s*name\s*\}\}/gi, '{{name}}').trim();
  if (!t) fail(`${what}: empty`);
  if (t.length > max) fail(`${what}: too long`);
  return t;
};
const words = (s: string) => s.replace(/\{\{name\}\}/g, ' ').toLowerCase().match(/[a-z']+/g) ?? [];
/** Sentences, including the sentences inside a quote ("Cat, bat, hat! Up we go!" gives two). */
const sentences = (s: string) => s.split(/(?<=[.!?,]["”])\s+|(?<=[.!?])\s+|["“](?=[A-Z])/).map((x) => x.replace(/^["“”\s]+/, '').trim()).filter(Boolean);
const hasPhrase = (text: string, phrase: string) => new RegExp(`(^|[^a-z])${phrase.replace(/[.*+?^${}()|[\]\\']/g, (c) => (c === "'" ? "['’]" : `\\${c}`))}([^a-z]|$)`, 'i').test(text);

function checkText(t: string, what: string) {
  if (/[–—―‒]/.test(t)) fail(`${what}: dash`);
  if (/\s-\s|\s--?\s|--/.test(t)) fail(`${what}: hyphen used as a dash`);
  if (/[<>`*_#\\]|https?:/i.test(t)) fail(`${what}: markup`);
  const rest = t.replace(/\{\{name\}\}/g, '');
  if (/[{}]/.test(rest)) fail(`${what}: stray placeholder`);
  for (const b of BANNED) if (hasPhrase(t, b)) fail(`${what}: banned "${b}"`);
  for (const b of SCARY) if (hasPhrase(t, b)) fail(`${what}: not for kids "${b}"`);
  for (const b of FAITH) if (hasPhrase(t, b)) fail(`${what}: faith word "${b}"`);
  // A capitalized common first name anywhere (sentence start included) is treated as an invented name.
  for (const tok of rest.match(/[A-Z][a-z]+/g) ?? []) if (FIRST_NAMES.has(tok.toLowerCase())) fail(`${what}: personal name`);
}

/** A capitalized word in the middle of a sentence is usually a name. Days, months, planets, Mom and Dad, and theme words are fine. */
function checkCaps(t: string, what: string, extraOk: Set<string>) {
  for (const s of sentences(t.replace(/\{\{name\}\}/g, 'Kid'))) {
    const toks = s.match(/[A-Za-z][A-Za-z']*/g) ?? [];
    toks.slice(1).forEach((tok) => {
      const bare = tok.replace(/'s$/, '');
      if (/^[A-Z]/.test(bare) && !OK_CAPS.has(bare) && !extraOk.has(bare.toLowerCase()) && bare !== 'Kid') fail(`${what}: possible name "${bare}"`);
    });
  }
}

/** Numbers that appear in a word problem, as digits or number words. */
function numbersIn(t: string): number[] {
  const out: number[] = [];
  for (const m of t.matchAll(/\d+/g)) out.push(Number(m[0]));
  for (const w of words(t)) { const i = NUM_WORDS.indexOf(w); if (i >= 0) out.push(i); }
  return out;
}

export function computeAnswer(op: '+' | '-' | 'compare', a: number, b: number): number {
  return op === '+' ? a + b : op === '-' ? a - b : Math.max(a, b);
}

/** Validates raw model output against the week. Returns clean WeekContent (answers recomputed) or throws ContentInvalid. */
export function validateContent(raw: unknown, f: WeekFacts, sf?: StoryFacts | null): WeekContent {
  if (typeof raw !== 'object' || raw === null) fail('not an object');
  const r = raw as Record<string, any>;
  const themeCaps = new Set([...f.themeWords, f.themeLabel, ...f.icons.flatMap((i) => [i.one, i.many])].flatMap((w) => w.toLowerCase().split(/[\s-]+/)));
  // Picture book mode: the scene story rules. Cast names are allowed in the rest too (a problem about Stomp).
  if (sf) for (const c of SCENES[sf.theme].cast) for (const part of c.name.toLowerCase().split(' ')) themeCaps.add(part);
  const story = sf ? validateStory(r.story, sf) : oldStory(r, f, themeCaps);
  // Word problems: numbers chosen by the model are checked, the answer is always ours.
  if (!Array.isArray(r.wordProblems)) fail('word problems missing');
  if (r.wordProblems.length < 4 || r.wordProblems.length > 6) fail('need 4 to 6 word problems');
  const wordProblems: WeekContent['wordProblems'] = r.wordProblems.map((p: any, i: number) => {
    const what = `problem ${i + 1}`;
    const text = tidy(p?.text, 220, what);
    checkText(text, what);
    checkCaps(text, what, themeCaps);
    const op = p?.op;
    if (!f.ops.includes(op)) fail(`${what}: op ${op} not allowed`);
    const a = p?.a, b = p?.b;
    if (!Number.isInteger(a) || !Number.isInteger(b)) fail(`${what}: numbers`);
    if (a < 0 || b < 0 || a > f.mathMax || b > f.mathMax) fail(`${what}: number out of range`);
    if (op === '-' && a < b) fail(`${what}: negative`);
    if (op === 'compare' && a === b) fail(`${what}: equal compare`);
    const answer = computeAnswer(op, a, b);
    if (answer > f.mathMax || answer < 0) fail(`${what}: answer out of range`);
    if (BIG_NUM_WORDS.test(text)) fail(`${what}: big number word`);
    const nums = numbersIn(text);
    if (nums.some((n) => n > f.mathMax)) fail(`${what}: number in text out of range`);
    if (!nums.includes(a) || !nums.includes(b)) fail(`${what}: text does not show both numbers`);
    if (a > 10 || b > 10) fail(`${what}: too many pictures`);
    if ((op === '+' || op === '-' || op === 'compare') && Math.max(a, b) < 1) fail(`${what}: nothing to count`);
    // The picture: the given id when it is one of this theme's, else none (the page matches one from the text).
    // A picture that the text doesn't talk about is dropped, so the page never shows eggs for a problem about T-rexes.
    const pic = typeof p?.icon === 'string' ? f.icons.find((x) => x.id === p.icon) : undefined;
    const th = f.theme as keyof typeof THEMES;
    const counted = countedIcon(th, text, [a, b]);
    const icon = pic && mentionsIcon(th, text, pic.id) && (counted === undefined || counted === pic.id) ? pic.id : undefined;
    return icon ? { text, a, b, op, answer, icon } : { text, a, b, op, answer };
  });

  // Tracing sentence
  const tracingSentence = tidy(r.tracingSentence, 60, 'tracing sentence');
  checkText(tracingSentence, 'tracing sentence');
  checkCaps(tracingSentence, 'tracing sentence', themeCaps);
  if (!/^[A-Za-z' ]+(-[A-Za-z]+)?[A-Za-z' ]*[.!]?$/.test(tracingSentence.replace(/\{\{name\}\}/g, 'Kid'))) fail('tracing sentence characters');
  if (tracingSentence.replace(/\{\{name\}\}/g, '').replace(/[^A-Za-z]/g, '').length > 36) fail('tracing sentence too long');
  const tw = tracingSentence.split(/\s+/).length;
  if (tw < 2 || tw > 8) fail('tracing sentence word count');

  // Parent note
  const teaches = tidy(r.parentNote?.teaches, 320, 'teaches');
  const why = tidy(r.parentNote?.why, 360, 'why');
  checkText(teaches, 'teaches');
  checkText(why, 'why');
  if (!Array.isArray(r.parentNote?.activities) || r.parentNote.activities.length < 2) fail('need 2 activities');
  const activities: string[] = r.parentNote.activities.slice(0, 2).map((a: unknown, i: number) => {
    const t = tidy(a, 240, `activity ${i + 1}`);
    checkText(t, `activity ${i + 1}`);
    return t;
  });
  for (const t of [teaches, why, ...activities]) checkCaps(t, 'parent note', themeCaps);
  // Sight word lists ("Sight words: like, must.") name the words; they are not pressure on the child.
  if (/should be able to|\bmust\b|\bbehind\b|\bdelay/i.test(`${teaches} ${why}`.replace(/Sight words?:[^.]*\./gi, ""))) fail('parent note pressure words');

  return { source: 'ai', story, wordProblems, tracingSentence, parentNote: { teaches, why, activities } };
}

/** The old little book story (themes with no picture book yet): 4 to 8 pages, one theme icon per page. */
function oldStory(r: Record<string, any>, f: WeekFacts, themeCaps: Set<string>): WeekContent['story'] {
  const title = tidy(r.story?.title, 60, 'title');
  checkText(title, 'title');
  if (!Array.isArray(r.story?.pages)) fail('story pages missing');
  const pages: string[] = r.story.pages.map((p: unknown, i: number) => tidy(p, 200, `page ${i + 1}`));
  if (pages.length < 4 || pages.length > 8) fail('story needs 4 to 8 pages');
  pages.forEach((p, i) => { checkText(p, `page ${i + 1}`); checkCaps(p, `page ${i + 1}`, themeCaps); });
  const storyText = pages.join(' ');
  if (!storyText.includes('{{name}}')) fail('story has no {{name}}');
  for (const s of sentences(storyText)) if (words(s).length > 14) fail('story sentence too long');
  const total = words(storyText).length + (storyText.match(/\{\{name\}\}/g) ?? []).length;
  const maxWords = f.level === 'pre-k' ? 120 : 180;
  if (total < 20 || total > maxWords) fail(`story length ${total} words`);
  if (/\byou\b|\byour\b/i.test(storyText)) fail('story speaks to the reader');
  const sw = new Set(words(storyText));
  if (f.familyWords.length) {
    const used = f.familyWords.filter((w) => sw.has(w)).length;
    if (used < 2) fail('story uses fewer than 2 word family words');
  }
  if (f.sightWords.length) {
    const used = f.sightWords.filter((w) => sw.has(w.toLowerCase())).length;
    if (used < Math.ceil(f.sightWords.length / 2)) fail('story misses the sight words');
  }
  // Pictures: icons[i] is kept only when it is one of this theme's pictures and page i names it. A dropped or
  // missing one leaves that page without a picture (it gets a "Draw it!" box). One such page is fine; more fails.
  const given: unknown[] = Array.isArray(r.story?.icons) ? r.story.icons : [];
  const icons: (string | null)[] = pages.map((p, i) => {
    const id = given[i];
    return typeof id === 'string' && f.icons.some((x) => x.id === id) && mentionsIcon(f.theme as keyof typeof THEMES, p, id) ? id : null;
  });
  if (icons.filter((x) => !x).length > 1) fail('story pages without a matching picture');
  const letters = f.letters.filter((l) => l !== 'x' && l !== 'q');
  const hits = letters.filter((l) => [...sw].some((w) => w.startsWith(l))).length;
  if (hits < Math.ceil((letters.length * 2) / 3)) fail('story misses the week\'s letters');

  return { title, pages, icons };
}

// ---------- Story v2: the big picture book ----------
// A story is a sequence of pre-drawn scenes (scenes.ts, only ones in sceneArt.json) with one page of words per scene.
// Every page must be true of its picture, the cast keeps its names, {{name}} is a friend who helps, and the story
// follows one arc: opening, explore or find, one problem, try and help, solve, then celebrate, rest or a goodbye.

export interface StoryFacts {
  theme: ThemeId;
  level: Level;
  pages: number;                                  // story pages in the book (6 Pre-K, 10 Kindergarten)
  cast: { name: string; kind: string; pronoun: string; describe: string }[];
  setting: string;
  /** The one ready path this week's story must use, picked by code (pickPath), trimmed to the book. */
  path: { id: string; title: string; plot: string; scenes: string[] };
  /** Kept for callers that list paths: just the picked one. */
  paths: { id: string; title: string; plot: string; scenes: string[] }[];
  scenes: Scene[];                                // the picked path's scenes, in reading order
  letters: string[];
  family?: string;
  familyWords: string[];
  sightWords: string[];
  nameWeek: boolean;
}

export interface PathChoice {
  /** The plan's week number (rotates the path). */
  weekIndex?: number;
  /** Path ids this child had in recent weeks (from cached content), skipped while another path is left. */
  avoid?: string[];
  /** Moves the rotation on (a "make a new story" redo). */
  shift?: number;
  /** Use this ready path (tests and the template check). */
  id?: string;
}

/** The facts the story writer needs, or null when the theme has no picture book ready for this level. */
export function storyFacts(f: WeekFacts, choice: PathChoice = {}): StoryFacts | null {
  const theme = f.theme as ThemeId;
  const T = SCENES[theme];
  const p = !T ? null : choice.id ? readyPaths(theme, f.level).find((x) => x.id === choice.id) ?? null : pickPath(theme, f.level, choice.weekIndex ?? 1, choice.avoid ?? [], choice.shift ?? 0);
  if (!T || !p) return null;
  const path = { id: p.id, title: p.title, plot: p.plot, scenes: p.fitted };
  return {
    theme, level: f.level, pages: BOOK_PAGES[f.level], setting: T.setting,
    cast: T.cast.map((c) => ({ name: c.name, kind: c.kind, pronoun: c.pronoun, describe: c.describe })),
    path, paths: [path],
    scenes: p.fitted.map((id) => sceneById(theme, id)!),
    letters: f.letters, family: f.family, familyWords: f.familyWords, sightWords: f.sightWords, nameWeek: f.base.kind === 'name',
  };
}

function storySystemPrompt(): string {
  return [
    'You are a children\'s picture book author writing for Tracelings, a site of printables for kids ages 3 to 7. A parent prints the book, cuts it out, and reads it aloud with their child, who then colors the pictures.',
    'The pictures are already drawn, in order, and you are told exactly what each picture shows. You write the words for each page. Return only JSON that matches the schema.',
    '',
    'How to write it:',
    '- Write one connected story with a beginning, a middle and an end. Each page follows from the page before, so a child can retell it: who, what went wrong, how friends helped, and the happy ending.',
    '- One gentle problem that the friends solve together with kindness. Nobody is mean, scared, hurt or in danger. A problem is something like a ball stuck in a tree, a hill that is too steep, or an egg that rolled away.',
    '- Read-aloud music: short lines, a little rhythm and a repeated line or sound the child can join in on ("Tap, tap, tap!", "Up, up, up!", "Not yet!"). Repeat one phrase on two or three pages.',
    '- Sound words and simple feelings are welcome. End warm: a celebration, a cozy rest or a happy goodbye.',
    '',
    'The pictures (follow every rule):',
    '- Every sentence on a page must be true of that page\'s picture. Name only what the picture shows: its characters and its things. Never say a character does something the picture does not show, and never add a thing, a place or an animal that is not in the picture.',
    '- Each page names at least one character or thing that is in its picture, using the given words for that scene where they fit.',
    '- Do not name a cast member on a page whose picture does not show them.',
    '- The thing that goes wrong is the thing that gets fixed: if the shell is lost, the shell is found; if the ball is stuck, the ball comes down.',
    '- Introduce each character and each important thing (the egg, the ball) the first time it is named, so a child who sees only this book can follow it.',
    '',
    'The cast and the child:',
    '- Use the cast names exactly as given, the same on every page. No pet forms or nicknames ("Snippy", "Stompy"). Do not invent any other names for anyone or anything.',
    '- The child is always the exact placeholder {{name}}. {{name}} is a friend in the story who is there the whole time but is never in the pictures, as if standing where the reader stands.',
    '- {{name}} may only say, spot, see, point, cheer, clap, count, or have an idea ("Look by the rocks!" says {{name}}). {{name}} never swims, climbs, rides, carries, grabs, holds, pushes, pulls, jumps, naps, eats, hugs, walks or does anything else that would have to be drawn.',
    '- {{name}} helps solve the problem with an idea or by spotting something. Put {{name}} on at least two pages, and on at least one page between the problem and the solve.',
    '- Write in the third person. Never use "you" or "your".',
    '',
    'House style:',
    '- No em dashes and no en dashes. Do not use a hyphen as a dash between words. Use a period or a comma.',
    '- Never use: unlock, seamless, elevate, dive in, journey, navigate, game-changer, "whether you\'re", "in today\'s world", "it\'s important to note", "look no further", "without further ado".',
    '- Nothing scary or unkind: no danger, injury, fighting, weapons, monsters, ghosts, fire, getting eaten, or anyone crying. Dinosaurs and dragons are friendly.',
    '- Faith neutral: no God, prayer, church, angels, or religious holidays. No brand names or real people.',
    '',
    'The book:',
    '- scenes: copy the given scene ids exactly, in the given order. Do not add, drop, swap or reorder scenes. pathId: the given path id.',
    '- pages: one string per scene, the same count and order as scenes.',
    '- title: 2 to 6 words. It may include {{name}}.',
  ].join('\n');
}

function storyUserPrompt(s: StoryFacts): string {
  const pre = s.level === 'pre-k';
  const lines = [
    `Reader: ${pre ? 'Pre-K (age 3 to 5). The grown-up reads it aloud.' : 'Kindergarten (age 5 to 6). A beginning reader reads some words with a grown-up.'}`,
    `Book length: exactly ${s.pages} pages (${s.pages} scenes).`,
    pageRuleText(s.level),
    pre
      ? 'Mostly 3 and 4 letter words a child can sound out, and very common words.'
      : 'Lean on short words a beginning reader can sound out (cat, hop, sun) and the sight words.',
    '',
    `Setting: ${s.setting}`,
    'Cast (use these names, the same on every page):',
    ...s.cast.map((c) => `- ${c.name}: ${c.kind}, ${c.pronoun}. Looks like ${c.describe}.`),
    '',
    'Teaching to work in naturally (do not force it into a page where it is not true of the picture; speech from {{name}} or a friend is a good place):',
  ];
  if (s.letters.length) lines.push(`- Letters of the week: ${s.letters.join(', ')}. Use several words that start with ${s.letters.length > 1 ? 'these letters' : 'this letter'}.`);
  if (s.family) lines.push(`- Word family -${s.family}: use at least 2 of ${s.familyWords.join(', ')}.`);
  else if (s.familyWords.length) lines.push(`- Word family review: use at least 2 of ${s.familyWords.join(', ')}.`);
  if (s.sightWords.length) lines.push(`- Sight words: ${s.sightWords.join(', ')}. Use each one.`);
  if (s.nameWeek) lines.push('- This is the name week: {{name}} can say or spell their own name in the story.');
  if (!s.letters.length && !s.familyWords.length && !s.sightWords.length && !s.nameWeek) lines.push('- Nothing extra this week. Keep the words short and friendly.');
  lines.push('', `This week's story (pathId "${s.path.id}"), working title "${s.path.title}": ${s.path.plot}`);
  lines.push('Its pictures, one per page, in this order (page: id [beat] what the picture shows | who is in it | things in it | words for it):');
  s.scenes.forEach((sc, i) => lines.push(`${i + 1}. ${sc.id} [${sc.beat}] ${sc.shows} | ${sc.cast.join(', ') || 'no cast'} | ${sc.props.join(', ')} | ${sc.words.join(', ')}`));
  return lines.join('\n');
}

export const STORY_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    pathId: { type: 'string' },
    scenes: { type: 'array', items: { type: 'string' }, minItems: 1 },
    pages: { type: 'array', items: { type: 'string' }, minItems: 1 },
  },
  required: ['title', 'pathId', 'scenes', 'pages'],
  additionalProperties: false,
} as const;

/** Picture book mode, one call: the story as a picture book plus the week's other parts. */
export const BOOK_SCHEMA = {
  ...OUTPUT_SCHEMA,
  properties: { ...OUTPUT_SCHEMA.properties, story: STORY_SCHEMA },
} as const;

function bookSystemPrompt(): string {
  return [
    storySystemPrompt(),
    '',
    'You also write the rest of the week for the same child, as plain text with no markdown:',
    '- Never invent a name for anyone. In these parts the cast names may be used.',
    '- Use soft words about learning: many kids, often, usually. Avoid "should be able to", "must", "always". Never shame a child or a parent.',
    '- No invented statistics, studies, quotes or experts.',
    ...REST_PARTS,
  ].join('\n');
}

function bookUserPrompt(f: WeekFacts, s: StoryFacts): string {
  return ['THE WEEK', ...weekLines(f, false), ...mathLines(f), '', 'THE STORY (the story field)', storyUserPrompt(s)].join('\n');
}

/** Little words that don't count as naming something in a picture. */
const STOP = new Set(['the', 'and', 'can', 'not', 'yes', 'see', 'look', 'got', 'get', 'did', 'it', 'is', 'up', 'go', 'in', 'on', 'out', 'hi', 'bye', 'fun', 'yay', 'big', 'little', 'one', 'two', 'three', 'try', 'help', 'back', 'home', 'down', 'top']);
/** An exclamation like "Oh no!" or "Tap, tap, tap!" is not counted as a sentence. */
const isExclaim = (s: string) => /!$/.test(s) && words(s).length <= 3;

/** What a page has to name: the scene's cast (by name or kind) and its things and words. */
function sceneTerms(theme: ThemeId, sc: Scene): string[] {
  const cast = castTerms(theme).filter((c) => sc.cast.includes(c.name)).flatMap((c) => c.terms);
  const things = [...sc.props, ...sc.words].map((w) => w.toLowerCase()).filter((w) => w.length >= 3 && !STOP.has(w));
  // "baby triceratops" also matches "baby"; "picnic blanket" also matches "blanket".
  const parts = sc.props.flatMap((p) => p.toLowerCase().split(' ')).filter((w) => w.length >= 4 && !STOP.has(w));
  return [...new Set([...cast, ...things, ...parts])];
}

/** Things the child ({{name}}) may do: talk, look, cheer, think. Anything else would have to be drawn. */
const CHILD_OK = new Set(['says', 'said', 'say', 'asks', 'asked', 'calls', 'called', 'shouts', 'shouted', 'yells', 'sings', 'sang', 'whispers', 'cheers', 'cheered', 'claps', 'clapped',
  'spots', 'spotted', 'sees', 'saw', 'see', 'looks', 'looked', 'watches', 'watched', 'points', 'pointed', 'counts', 'counted', 'thinks', 'thought', 'has', 'had', 'knows', 'knew',
  'smiles', 'smiled', 'laughs', 'laughed', 'giggles', 'helps', 'helped', 'hears', 'heard', 'finds', 'found', 'is', 'was', 'can', 'cheer', 'clap', 'spot', 'point', 'count',
  'gets', 'got', 'likes', 'loves', 'waves', 'waved', 'nods', 'reads', 'spells', 'guesses', 'wonders', 'listens', 'and', 'too', 'will', 'did', 'does', 'gasps', 'grins', 'idea']);
/** Actions that would need the child in the picture. */
const CHILD_DRAWN = /\b(swims?|swam|climbs?|climbed|rides?|rode|grabs?|grabbed|naps?|napped|sleeps?|slept|carries|carried|carry|holds?|held|pushes|pushed|pulls|pulled|jumps?|jumped|hops?|hopped|runs?|ran|walks?|walked|eats?|ate|hugs?|hugged|kicks?|kicked|throws?|threw|catches|caught|picks?|lifts?|lifted|digs?|dug|wades?|waded|splash(es|ed)?|dances?|danced|sits?|sat|stands?|stood|tugs?|tugged|flies|flew|drives?|drove|rolls?|rolled|pets?|petted|feeds?|fed|tosses|tossed|hides?|hid|reaches|reached|gives?|gave|takes?|took|brings?|brought|puts?|wears?|washes|scrubs?|plays?|played|goes|went|steps?|stepped|crawls?|crawled|bounces?|slides?|trots?|paddles?|follows?|followed)\b/i;
const CRYING = /\b(cry|cries|cried|crying|tears?|sob|sobs|sobbed|weep|weeps|wept|wail|wails)\b/i;
/** Words that start a sentence and are not names (checked against invented names at sentence start). */
const START_OK = new Set(['the', 'a', 'an', 'and', 'but', 'so', 'then', 'now', 'oh', 'no', 'yes', 'look', 'up', 'down', 'in', 'out', 'at', 'on', 'it', 'he', 'she', 'they', 'we', 'i', 'his', 'her', 'its', 'their',
  'here', 'there', 'where', 'what', 'who', 'how', 'why', 'when', 'one', 'two', 'three', 'four', 'five', 'all', 'hi', 'hello', 'bye', 'good', 'what', 'wow', 'yay', 'yum', 'hooray', 'hip', 'tap', 'pop', 'splash',
  'come', 'let', 'lets', 'get', 'go', 'stop', 'big', 'little', 'next', 'back', 'soon', 'later', 'today', 'at', 'with', 'off', 'over', 'away', 'thank', 'thanks', 'shh', 'ah', 'uh', 'ding', 'clink', 'crack',
  'swish', 'thump', 'hiss', 'zoom', 'beep', 'toot', 'puff', 'chug', 'bump', 'bam', 'whee', 'wheee', 'push', 'pull', 'tug', 'spin', 'hop', 'step', 'run', 'jump', 'kick', 'scrub', 'drip', 'swing',
  'roll', 'turn', 'make', 'have', 'ask', 'call', 'try', 'use', 'take', 'this', 'that', 'these', 'those', 'some', 'every', 'each', 'not', 'very', 'so', 'too', 'just', 'still', 'again', 'first', 'last', 'more']);

/** Sentences of a page with the child's name in them. */
function childSentences(p: string): string[] { return sentences(p).filter((x) => x.includes('{{name}}')); }

/** Why a sentence has the child doing something that would have to be drawn, or null. Speech in quotes is fine
 *  ("Swim to it!" says {{name}}), and so are the verbs in CHILD_OK right after the name. */
export function childActionProblem(sentence: string): string | null {
  const bare = sentence.replace(/["“][^"”]*["”]/g, ' QUOTE ');
  if (!bare.includes('{{name}}')) return null;
  // "{{name}} swims", "{{name}} and Flip swim", "Flip and {{name}} swim", "{{name}} can climb".
  const m = bare.match(/\{\{name\}\}((?:\s+(?:and|with)\s+[A-Za-z]+(?:\s+[A-Za-z]+)?)?)\s+(?:(?:can|will|gets? to|tries to|wants to|starts to|helps(?:\s+[A-Z][a-z]+)?)\s+)?([a-z]+)/);
  const before = bare.match(/\b(?:[A-Z][a-z]+|the [a-z]+)\s+and\s+\{\{name\}\}\s+([a-z]+)/);
  for (const verb of [m?.[2], before?.[1]]) {
    if (verb && !CHILD_OK.has(verb) && CHILD_DRAWN.test(verb)) return `{{name}} ${verb}, which would need {{name}} in the picture`;
  }
  // "{{name}} ... too" after a drawn action by someone else: "Snip naps, and {{name}} naps too" is caught above.
  return null;
}

/**
 * Validates a scene story against the week (also used on the templates). Throws ContentInvalid.
 * teaching=false skips the week's letters, word family and sight word checks (templates fill those in where they fit).
 */
export function validateStory(raw: unknown, s: StoryFacts, opts: { teaching?: boolean } = {}): WeekContent['story'] {
  if (typeof raw !== 'object' || raw === null) fail('story: not an object');
  const r = raw as Record<string, any>;
  const T = SCENES[s.theme];
  const castNames = T.cast.map((c) => c.name);
  const okCaps = new Set([...castNames.flatMap((n) => n.toLowerCase().split(' ')), ...T.cast.flatMap((c) => c.words.flatMap((w) => w.toLowerCase().split(/[\s-]+/))),
    ...THEMES[s.theme].nouns.flatMap((w) => w.toLowerCase().split(/[\s-]+/)), ...THEMES[s.theme].icons.flatMap((i) => [i.one, i.many]).flatMap((w) => w.toLowerCase().split(/[\s-]+/)), 'coach']);

  const title = tidy(r.title, 60, 'title');
  checkText(title, 'title');

  // Scenes: exactly the path the server picked. No self-built sequences, so the plot can't jump.
  if (!Array.isArray(r.scenes) || !r.scenes.every((x: unknown) => typeof x === 'string')) fail('scenes missing');
  const scenes: string[] = r.scenes;
  for (const id of scenes) if (!sceneById(s.theme, id) || !sceneArt(s.theme, id)) fail(`unknown scene "${id}"`);
  if (scenes.length !== s.pages) fail(`needs ${s.pages} pages, got ${scenes.length}`);
  const arc = arcProblem(s.theme, scenes);
  if (arc) fail(`story arc: ${arc}`);
  if (scenes.join(',') !== s.path.scenes.join(',')) fail(`scenes are not the given story path (${s.path.id})`);
  const pathId = s.path.id;

  if (!Array.isArray(r.pages)) fail('story pages missing');
  const pages: string[] = r.pages.map((p: unknown, i: number) => tidy(p, 220, `page ${i + 1}`));
  if (pages.length !== scenes.length) fail('pages and scenes differ in count');

  const allTerms = castTerms(s.theme);
  pages.forEach((p, i) => {
    const what = `page ${i + 1}`;
    checkText(p, what);
    checkCaps(p, what, okCaps);
    checkStartNames(p, what, okCaps);
    if (CRYING.test(p)) fail(`${what}: crying`);
    const sc = sceneById(s.theme, scenes[i])!;
    // True of the picture: names something in it, and no cast member who isn't in it.
    if (!sceneTerms(s.theme, sc).some((t) => hasPhrase(p, t))) fail(`${what}: does not name anything in its picture (${sc.id})`);
    // A name counts only capitalized ("chug!" the sound is not Chug the engine). Someone not in the picture may be
    // named only to say they are missing ("Where is Nibs?" over the empty cage), which is true of that picture.
    for (const sent of sentences(p)) {
      if (/\b(where|gone|lost|missing|not here)\b/i.test(sent)) continue;
      for (const c of allTerms) {
        if (sc.cast.includes(c.name)) continue;
        const named = c.terms.some((t) => (c.name.toLowerCase().split(' ').includes(t)
          ? new RegExp(`(^|[^A-Za-z])${t.charAt(0).toUpperCase()}${t.slice(1)}([^a-z]|$)`).test(sent)
          : hasPhrase(sent, t)));
        if (named) fail(`${what}: names ${c.name}, who is not in the picture (${sc.id})`);
      }
    }
    // The child is never drawn, so the child only talks, looks, cheers and has ideas.
    for (const sent of childSentences(p)) { const why = childActionProblem(sent); if (why) fail(`${what}: ${why}`); }
    const len = pageLengthProblem(s.level, p);
    if (len) fail(`${what}: ${len}`);
  });

  const text = pages.join(' ');
  const withName = pages.map((p, i) => (p.includes('{{name}}') ? i : -1)).filter((i) => i >= 0);
  if (!withName.length) fail('story has no {{name}}');
  if (withName.length < 2) fail('{{name}} is on fewer than 2 pages');
  const beats = scenes.map((id) => sceneById(s.theme, id)!.beat);
  const p0 = beats.indexOf('problem'), s0 = beats.indexOf('solve');
  if (!withName.some((i) => i >= p0 && i <= s0)) fail('{{name}} does not help with the problem');
  if (/\byou\b|\byour\b/i.test(text)) fail('story speaks to the reader');
  // Cast names stay as given: no pet forms ("Stompy", "Snippy", "Dottie"), anywhere in a sentence.
  for (const c of T.cast) {
    const short = c.name.split(' ').pop()!;
    // Capitalized only: "Bun" may meet a "bunny", and "Bump" may drive a "bumpy" road.
    for (const m of text.matchAll(new RegExp(`\\b${short}${short.slice(-1)}?(y|ie|ey|o|a|i|ster|kins|sy)\\b`, 'g'))) {
      if (!okCaps.has(m[0].toLowerCase())) fail(`cast name changed (${c.name})`);
    }
  }
  const about = T.paths.find((p) => p.id === pathId)?.about ?? [];
  // The thing that went wrong is the thing that gets fixed: the problem page and the solve page both name it.
  if (about.length) {
    const hit = (pg: string) => about.some((w) => (/^[A-Z]/.test(w) ? pg.includes(w) : hasPhrase(pg, w) || hasPhrase(pg, `${w}s`) || hasPhrase(pg, `${w}es`)));
    if (!hit(pages[p0])) fail(`the problem page does not name what the problem is about (${about.join(' or ')})`);
    if (!hit(pages[s0])) fail(`the solve page does not fix the same thing (${about.join(' or ')})`);
  }

  if (opts.teaching !== false) {
    const sw = new Set(words(text));
    if (s.familyWords.length && s.familyWords.filter((w) => sw.has(w)).length < 2) fail('story uses fewer than 2 word family words');
    if (s.sightWords.length && s.sightWords.filter((w) => sw.has(w.toLowerCase())).length < Math.ceil(s.sightWords.length / 2)) fail('story misses the sight words');
    const letters = s.letters.filter((l) => l !== 'x' && l !== 'q');
    const hits = letters.filter((l) => [...sw].some((w) => w.startsWith(l))).length;
    if (hits < Math.ceil((letters.length * 2) / 3)) fail('story misses the week\'s letters');
  }
  return { title, pages, scenes, pathId };
}

/** A capitalized word starting a sentence that is not a known word is an invented name ("Rosie waves too."). */
function checkStartNames(t: string, what: string, extraOk: Set<string>) {
  for (const s of sentences(t.replace(/\{\{name\}\}/g, 'Kid'))) {
    const first = s.replace(/^["“'(]+/, '').match(/^[A-Z][a-z']+/)?.[0];
    if (!first) continue;
    const lw = first.toLowerCase().replace(/'s$/, '');
    if (first === 'Kid' || START_OK.has(lw) || extraOk.has(lw) || OK_CAPS.has(first)) continue;
    if (FIRST_NAMES.has(lw) || PROPER_NAMES.has(first)) fail(`${what}: possible name "${first}"`);
  }
}

/** Pulls the JSON object out of a Messages API response body. */
export function parseResponse(body: any): unknown {
  if (body?.stop_reason === 'refusal') fail('refusal');
  if (body?.stop_reason === 'max_tokens') fail('truncated');
  const text = (body?.content ?? []).filter((c: any) => c?.type === 'text').map((c: any) => c.text).join('');
  if (!text) fail('no text');
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end <= start) fail('no JSON');
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return fail('bad JSON'); }
}

// ---------- Picture-truth check (a second, cheap model call) ----------
// Code checks words against the scene's lists, but it can't tell "Snip climbs a palm tree" is not in a picture that
// shows a crab holding a shell. So after a story passes the code checks, the cheap model (PROGRAM_AI_MODEL) gets each
// page's words and the description of its picture and answers, per page, whether everything the words say happens or
// appears is in the picture. Any "no" fails the story (it gets the same one retry as any other failed rule).

export const CHECK_SCHEMA = {
  type: 'object',
  properties: {
    pages: { type: 'array', items: { type: 'object', properties: {
      page: { type: 'integer' }, matches: { type: 'boolean' }, missing: { type: 'string' },
    }, required: ['page', 'matches', 'missing'], additionalProperties: false } },
  },
  required: ['pages'],
  additionalProperties: false,
} as const;

function checkSystemPrompt(): string {
  return [
    'You check a children\'s picture book before it is printed. Each page has words and one picture, and you are told exactly what the picture shows.',
    'For each page, answer whether every action, object, animal and character the words say is happening or is there can be seen in the picture as described.',
    'Rules:',
    '- {{name}} is the child reading the book. {{name}} is never in the pictures. {{name}} saying, seeing, pointing, cheering, clapping, counting or having an idea is fine. {{name}} doing anything else (swimming, climbing, holding, napping, riding) does not match.',
    '- Words spoken in quotes are fine when they are an idea or a call ("Look by the rocks!"), even if the thing said has not happened yet.',
    '- Sound words ("Splash!", "Tap, tap!") and feelings ("He is happy") are fine when nothing in the picture contradicts them.',
    '- A page does not match when it names a character who is not in the picture, says a character does something the picture does not show, adds a thing or place that is not there, or says something is missing that the picture shows (or the other way round).',
    '- Count things: "two balls" does not match a picture with one ball.',
    'Answer for every page. matches: true or false. missing: empty when it matches, else a few words on what is not in the picture.',
  ].join('\n');
}
function checkUserPrompt(story: WeekContent['story'], theme: ThemeId): string {
  const lines = ['Pages:'];
  story.pages.forEach((p, i) => {
    const sc = sceneById(theme, story.scenes![i])!;
    lines.push(`Page ${i + 1}. Words: ${p}`, `Picture: ${sc.shows} (characters in it: ${sc.cast.join(', ') || 'none'})`);
  });
  return lines.join('\n');
}
/** Reads the checker's answer. Throws ContentInvalid naming the first page that does not match its picture. */
export function readPictureCheck(body: unknown, pages: number): void {
  const r = parseResponse(body) as { pages?: { page?: number; matches?: boolean; missing?: string }[] };
  if (!r || !Array.isArray(r.pages)) fail('picture check: no answer');
  const seen = new Set<number>();
  for (const x of r.pages!) {
    if (!Number.isInteger(x?.page) || x.page! < 1 || x.page! > pages) continue;
    seen.add(x.page!);
    if (x.matches !== true) fail(`page ${x.page}: the words say something the picture does not show${x.missing ? ` (${String(x.missing).slice(0, 80)})` : ''}`);
  }
  if (seen.size < pages) fail('picture check: not every page was checked');
}

// ---------- The call ----------

export interface CallRequest { system: string; user: string; signal: AbortSignal; mode: 'book' | 'classic' | 'check' }
export type Caller = (req: CallRequest) => Promise<unknown>;

/** The Messages API body for a call. Book mode: the story model writes the week in one call, with the story as a
 *  picture book. Classic: the cheap model and the old little book (themes without scene art yet). Check: the cheap
 *  model checks each page against its picture. Never a name. */
export function requestBody(req: Pick<CallRequest, 'system' | 'user' | 'mode'>): Record<string, unknown> {
  if (req.mode === 'book') {
    return {
      model: PROGRAM_STORY_MODEL,
      // Sonnet 5.5 rejects non-default temperature, top_p and top_k (400) and rejects thinking "disabled", so it runs
      // with adaptive thinking at a modest effort. Thinking counts toward max_tokens, so there is plenty of room.
      max_tokens: 12000,
      thinking: { type: 'adaptive' },
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
      output_config: { effort: STORY_EFFORT, format: { type: 'json_schema', schema: BOOK_SCHEMA } },
    };
  }
  return {
    model: PROGRAM_AI_MODEL,
    // Haiku 5.5 rejects temperature values other than 1 (400), so no sampling parameters are sent. Its adaptive
    // thinking would count toward max_tokens; these are short structured jobs, so thinking is turned off.
    max_tokens: req.mode === 'check' ? 1500 : 3000,
    thinking: { type: 'disabled' },
    system: req.system,
    messages: [{ role: 'user', content: req.user }],
    output_config: { format: { type: 'json_schema', schema: req.mode === 'check' ? CHECK_SCHEMA : OUTPUT_SCHEMA } },
  };
}

const anthropicCaller: Caller = async ({ system, user, signal, mode }) => {
  const res = await fetch(API_URL, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', 'x-api-key': env('ANTHROPIC_API_KEY')!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(requestBody({ system, user, mode })),
  });
  if (!res.ok) {
    // Log the status only. Never log the prompt or the response text.
    throw new Error(`anthropic ${res.status}`);
  }
  return res.json();
};

// ---------- Cost ----------

/** USD per million tokens (input, output), from the Anthropic pricing page (Oct 2026). Haiku 5.5 prompts here are
 *  far under 100k tokens, so its base price applies. */
export const PRICES: Record<string, { input: number; output: number }> = {
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
};
/** Rough token counts for one week (measured from the prompts; output includes Sonnet's adaptive thinking). */
export function estimateWeekCost(level: Level = 'kindergarten', attempts = 1): { usd: number; parts: { call: string; model: string; input: number; output: number; usd: number }[] } {
  const k = level === 'kindergarten';
  const calls = [
    { call: 'story and week (book)', model: PROGRAM_STORY_MODEL, input: k ? 4200 : 3600, output: k ? 3500 : 2800 },
    { call: 'picture-truth check', model: PROGRAM_AI_MODEL, input: k ? 1500 : 1000, output: k ? 350 : 220 },
  ];
  const parts = calls.map((c) => {
    const p = PRICES[c.model] ?? PRICES['claude-sonnet-5-5'];
    return { ...c, input: c.input * attempts, output: c.output * attempts, usd: ((c.input * p.input + c.output * p.output) / 1e6) * attempts };
  });
  return { usd: parts.reduce((a, b) => a + b.usd, 0), parts };
}

export interface GenerateOptions {
  /** Called before every model call (including the picture check). Return false to stop (caps reached). It only
   *  checks the caps: generations are counted by the caller once one succeeds and is saved. */
  reserve?: () => Promise<boolean>;
  caller?: Caller;
  timeoutMs?: number;
  /** Which ready path to use: the plan week, recent paths to skip, and a shift for redos. */
  path?: PathChoice;
}
export interface GenerateResult {
  content: WeekContent;
  /** Model calls made, the picture checks included. */
  calls: number;
  /** Story attempts that came back but failed a check (0, 1 or 2). */
  failed: number;
  reason?: 'no-key' | 'capped' | 'call-failed' | 'invalid';
}

/** AI content for a child-week, or the template when anything goes wrong. Never throws. */
export async function generateWeekContent(profile: ChildProfile, week: ProgramWeek, opts: GenerateOptions = {}): Promise<GenerateResult> {
  const template = (): WeekContent => ({ ...templateContentFor(profile, week), source: 'template' });
  const caller = opts.caller ?? (aiConfigured() ? anthropicCaller : null);
  if (!caller) return { content: template(), calls: 0, failed: 0, reason: 'no-key' };
  let facts: WeekFacts;
  try { facts = weekFacts(profile, week); } catch { return { content: template(), calls: 0, failed: 0, reason: 'invalid' }; }
  // The picture book when this theme has ready scene art for the level, else the old little book.
  const sf = storyFacts(facts, { weekIndex: week.index, ...(opts.path ?? {}) });
  const mode: CallRequest['mode'] = sf ? 'book' : 'classic';
  const system = sf ? bookSystemPrompt() : systemPrompt();
  const user = sf ? bookUserPrompt(facts, sf) : userPrompt(facts);
  let retryNote = '';
  let calls = 0, failed = 0;
  const call = async (req: Omit<CallRequest, 'signal'>, timeout: number): Promise<unknown> => {
    let ok = true;
    try { ok = opts.reserve ? await opts.reserve() : true; } catch (e) { console.error('program ai: reserve failed', (e as Error).message); ok = false; }
    if (!ok) throw new Capped();
    calls++;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), opts.timeoutMs ?? timeout);
    try { return await caller({ ...req, signal: ctl.signal }); } catch (e) {
      console.error('program ai: call failed', ctl.signal.aborted ? 'timeout' : (e as Error).message);
      throw new CallFailed();
    } finally { clearTimeout(timer); }
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const body = await call({ system, user: user + retryNote, mode }, sf ? STORY_TIMEOUT_MS : AI_TIMEOUT_MS);
      const content = validateContent(parseResponse(body), facts, sf);
      if (sf) readPictureCheck(await call({ system: checkSystemPrompt(), user: checkUserPrompt(content.story, sf.theme), mode: 'check' }, AI_TIMEOUT_MS), content.story.pages.length);
      return { content, calls, failed };
    } catch (e) {
      if (e instanceof Capped) return { content: template(), calls, failed, reason: 'capped' };
      if (e instanceof CallFailed) return { content: template(), calls, failed, reason: 'call-failed' };
      if (!(e instanceof ContentInvalid)) throw e;
      failed++;
      const why = e.message.replace(/"[^"]*"/g, '"…"').replace(/\([^)]*\)$/, '').trim();
      console.warn('program ai: invalid output', why, `(attempt ${attempt + 1})`);
      // The retry is told which rule failed (never any quoted text), so it can fix that one thing.
      retryNote = `\n\nAn earlier answer was not used because of this rule: ${why}. Follow every rule this time.`;
    }
  }
  return { content: template(), calls, failed, reason: 'invalid' };
}
class Capped extends Error {}
class CallFailed extends Error {}

/** For tests: the prompts the model would see for a week. Contains no name. */
export const _prompts = (profile: ChildProfile, week: ProgramWeek, path: PathChoice = {}) => {
  const f = weekFacts(profile, week);
  const sf = storyFacts(f, { weekIndex: week.index, ...path });
  return sf ? { mode: 'book' as const, system: bookSystemPrompt(), user: bookUserPrompt(f, sf), pathId: sf.path.id } : { mode: 'classic' as const, system: systemPrompt(), user: userPrompt(f) };
};
/** For tests: the picture check prompt for a story. */
export const _checkPrompts = (story: WeekContent['story'], theme: ThemeId) => ({ system: checkSystemPrompt(), user: checkUserPrompt(story, theme) });
