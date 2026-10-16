// AI content for one child-week of the personalized program (server only).
// Calls the Anthropic Messages API with fetch (env ANTHROPIC_API_KEY, model PROGRAM_AI_MODEL). Everything the model
// returns is checked in code; word problem answers are always recomputed here. When the key is missing, the call fails,
// times out, or the output fails validation twice, the parent gets the themed template instead. Never an error.
// The child's name is never sent: the model writes the literal placeholder {{name}}, and the browser swaps it in.
import type { ChildProfile, ProgramWeek, WeekContent } from '../program/types';
import { templateContentFor } from '../program/templates';
import * as themesMod from '../program/themes';
import { PLANS as BASE_PLANS, FAMILIES, type Week } from '../homeschool';

const env = (k: string): string | undefined => ((import.meta.env ?? {}) as Record<string, string | undefined>)[k] ?? process.env[k];

export const PROGRAM_AI_MODEL = env('PROGRAM_AI_MODEL') || 'claude-haiku-5-5';
const API_URL = env('ANTHROPIC_BASE_URL') ? `${env('ANTHROPIC_BASE_URL')}/v1/messages` : 'https://api.anthropic.com/v1/messages';
export const AI_TIMEOUT_MS = 15_000;
export const aiConfigured = () => Boolean(env('ANTHROPIC_API_KEY'));

// ---------- What the week teaches ----------

export interface WeekFacts {
  level: ProgramWeek['level'];
  base: Week;
  theme: string;           // theme id
  themeLabel: string;      // "dinosaurs"
  themeWords: string[];
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

/** Theme label and word list from Part A's themes.ts, read defensively so a small shape change there can't break this. */
export function themeInfo(id: string): { label: string; words: string[] } {
  const m = themesMod as unknown as Record<string, any>;
  const t = m.THEMES?.[id] ?? m.themes?.[id] ?? (typeof m.themeFor === 'function' ? m.themeFor(id) : undefined) ?? (typeof m.getTheme === 'function' ? m.getTheme(id) : undefined);
  const label = String(t?.label ?? t?.name ?? t?.title ?? id).toLowerCase();
  const raw = t?.words ?? t?.wordList ?? t?.vocab ?? [];
  const words = Array.isArray(raw) ? raw.map((w: unknown) => (typeof w === 'string' ? w : (w as any)?.word)).filter((w: unknown): w is string => typeof w === 'string' && w.length > 0 && w.length < 24).slice(0, 20) : [];
  return { label, words };
}

export function weekFacts(profile: ChildProfile, week: ProgramWeek): WeekFacts {
  const base = BASE_PLANS[week.level].weeks[week.baseWeek - 1];
  const { label, words } = themeInfo(week.theme);
  const familyWords = base.family ? FAMILIES[base.family] ?? [] : (base.families ?? []).flatMap((f) => (FAMILIES[f] ?? []).slice(0, 2));
  let mathMax: number;
  let ops: WeekFacts['ops'];
  if (base.addTo) { mathMax = base.addTo; ops = ['+', '-', 'compare']; }
  else if (week.level === 'pre-k') { mathMax = Math.min(10, Math.max(3, base.number ?? 5)); ops = ['+', 'compare']; }
  else { mathMax = Math.min(10, Math.max(5, base.number ?? 5)); ops = ['+', '-', 'compare']; }
  return {
    level: week.level, base, theme: week.theme, themeLabel: label, themeWords: words,
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
    '- wordProblems: 4 to 6 short problems about the theme, each one or two sentences read aloud by the grown-up. Use only the numbers allowed for the week. Each problem lists a, b, op and an answer. op "+" means a plus b. op "-" means a minus b, with a at least b. op "compare" asks which number is more, with a and b different; the answer is the bigger number. Write a and b as digits in the text. Do not put the answer in the text. Do not use any other numbers.',
    '- tracingSentence: one short sentence for the child to trace, 3 to 7 words and at most 36 letters, about the theme. It may use {{name}}. Letters, spaces and a final period or exclamation mark only.',
    '- parentNote: written to the grown-up. teaches: one or two sentences on what this week teaches. why: one or two sentences on why it helps right now. activities: exactly 2 off-paper activity ideas tied to the theme, each one sentence, using things most homes have. Do not talk to the child here.',
  ].join('\n');
}

function userPrompt(f: WeekFacts): string {
  const lines = [
    `Level: ${f.level === 'pre-k' ? 'Pre-K' : 'Kindergarten'}. Age: ${f.ageYears}.`,
    `This week: ${f.base.title}${f.extraReview ? ' (an extra review week, so keep it gentle and familiar)' : ''}.`,
    `Theme: ${f.themeLabel}.${f.themeWords.length ? ` Theme words you can use: ${f.themeWords.join(', ')}.` : ''}`,
  ];
  if (f.letters.length) lines.push(`Letters in focus: ${f.letters.join(', ')}. Use several words that start with ${f.letters.length > 1 ? 'each of these letters' : 'this letter'} in the story.`);
  if (f.family) lines.push(`Word family: -${f.family}. Use at least 2 of these words in the story: ${f.familyWords.join(', ')}.`);
  else if (f.familyWords.length) lines.push(`Word families to review: ${f.familyWords.join(', ')}. Use at least 2 of them in the story.`);
  if (f.sightWords.length) lines.push(`Sight words this week: ${f.sightWords.join(', ')}. Use each one in the story.`);
  if (f.base.kind === 'name') lines.push('This is the name week, so the story can be about {{name}} and the letters in their name.');
  lines.push(`Skills in focus: ${f.focus.join(', ') || 'general review'}.`);
  lines.push(`Word problems: every number is a whole number from 0 to ${f.mathMax}, and every answer is at most ${f.mathMax}. Allowed op values: ${f.ops.map((o) => `"${o}"`).join(', ')}.`);
  lines.push(f.level === 'pre-k'
    ? 'Keep the story very simple: mostly 3 and 4 letter words, about 40 to 90 words in all.'
    : 'Keep the story simple: mostly short words, about 60 to 140 words in all.');
  return lines.join('\n');
}

export const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    story: { type: 'object', properties: { title: { type: 'string' }, pages: { type: 'array', items: { type: 'string' }, minItems: 1 } }, required: ['title', 'pages'], additionalProperties: false },
    wordProblems: { type: 'array', minItems: 1, items: { type: 'object', properties: {
      text: { type: 'string' }, a: { type: 'integer' }, b: { type: 'integer' }, op: { type: 'string', enum: ['+', '-', 'compare'] }, answer: { type: 'integer' },
    }, required: ['text', 'a', 'b', 'op', 'answer'], additionalProperties: false } },
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
const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
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
export function validateContent(raw: unknown, f: WeekFacts): WeekContent {
  if (typeof raw !== 'object' || raw === null) fail('not an object');
  const r = raw as Record<string, any>;
  const themeCaps = new Set([...f.themeWords, f.themeLabel].flatMap((w) => w.toLowerCase().split(/\s+/)));

  // Story
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
  const letters = f.letters.filter((l) => l !== 'x' && l !== 'q');
  const hits = letters.filter((l) => [...sw].some((w) => w.startsWith(l))).length;
  if (hits < Math.ceil((letters.length * 2) / 3)) fail('story misses the week\'s letters');

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
    return { text, a, b, op, answer };
  });

  // Tracing sentence
  const tracingSentence = tidy(r.tracingSentence, 60, 'tracing sentence');
  checkText(tracingSentence, 'tracing sentence');
  checkCaps(tracingSentence, 'tracing sentence', themeCaps);
  if (!/^[A-Za-z' ]+[.!]?$/.test(tracingSentence.replace(/\{\{name\}\}/g, 'Kid'))) fail('tracing sentence characters');
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
  if (/should be able to|\bmust\b|\bbehind\b|\bdelay/i.test(`${teaches} ${why}`)) fail('parent note pressure words');

  return { source: 'ai', story: { title, pages }, wordProblems, tracingSentence, parentNote: { teaches, why, activities } };
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

// ---------- The call ----------

export type Caller = (req: { system: string; user: string; signal: AbortSignal }) => Promise<unknown>;

const anthropicCaller: Caller = async ({ system, user, signal }) => {
  const res = await fetch(API_URL, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', 'x-api-key': env('ANTHROPIC_API_KEY')!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: PROGRAM_AI_MODEL,
      max_tokens: 1800,
      temperature: 0.8,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    }),
  });
  if (!res.ok) {
    // Log the status only. Never log the prompt or the response text.
    throw new Error(`anthropic ${res.status}`);
  }
  return res.json();
};

export interface GenerateOptions {
  /** Called before every model call. Return false to stop (caps reached). */
  reserve?: () => Promise<boolean>;
  caller?: Caller;
  timeoutMs?: number;
}
export interface GenerateResult { content: WeekContent; calls: number; reason?: 'no-key' | 'capped' | 'call-failed' | 'invalid' }

/** AI content for a child-week, or the template when anything goes wrong. Never throws. */
export async function generateWeekContent(profile: ChildProfile, week: ProgramWeek, opts: GenerateOptions = {}): Promise<GenerateResult> {
  const template = (): WeekContent => ({ ...templateContentFor(profile, week), source: 'template' });
  const caller = opts.caller ?? (aiConfigured() ? anthropicCaller : null);
  if (!caller) return { content: template(), calls: 0, reason: 'no-key' };
  let facts: WeekFacts;
  try { facts = weekFacts(profile, week); } catch { return { content: template(), calls: 0, reason: 'invalid' }; }
  const system = systemPrompt();
  const user = userPrompt(facts);
  let calls = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (opts.reserve && !(await opts.reserve())) return { content: template(), calls, reason: 'capped' };
    } catch (e) {
      console.error('program ai: reserve failed', (e as Error).message);
      return { content: template(), calls, reason: 'capped' };
    }
    calls++;
    let body: unknown;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), opts.timeoutMs ?? AI_TIMEOUT_MS);
    try {
      body = await caller({ system, user, signal: ctl.signal });
    } catch (e) {
      console.error('program ai: call failed', ctl.signal.aborted ? 'timeout' : (e as Error).message);
      return { content: template(), calls, reason: 'call-failed' };
    } finally {
      clearTimeout(timer);
    }
    try {
      return { content: validateContent(parseResponse(body), facts), calls };
    } catch (e) {
      if (!(e instanceof ContentInvalid)) throw e;
      console.warn('program ai: invalid output', e.message.replace(/"[^"]*"/g, '"…"'), `(attempt ${attempt + 1})`);
    }
  }
  return { content: template(), calls, reason: 'invalid' };
}

/** For tests: the prompts the model would see for a week. Contains no name. */
export const _prompts = (profile: ChildProfile, week: ProgramWeek) => ({ system: systemPrompt(), user: userPrompt(weekFacts(profile, week)) });
