// Tracelings at Home: the 36-week Pre-K and Kindergarten plans, and the printable pages in each weekly pack.
// Plans are plain data so the static pages can list every week. Pages are built with the same glyphs as the
// tracing tools, so everything runs in the browser and the child's name never leaves the device.
import { PAPER, COLORS, buildSheet, styleName, layoutWord, type Item, type Page, type Paper } from './sheet';
import { drawText, drawCell, buildWordPages } from './rowSheet';
import { buildColoringPage } from './coloring';
import type { LoadedFont } from './fontshape';
import { SITE } from '../config';
import lettersData from '../data/letters.json';
import sightData from '../data/sight-words.json';

export type Level = 'pre-k' | 'kindergarten';
export type WeekKind = 'name' | 'letter' | 'review' | 'family' | 'vowel-review';

export interface Week {
  n: number;
  kind: WeekKind;
  title: string; // "Letter S", "Review: S, A, T", "Word family -at"
  letters: string[]; // lowercase letters in focus
  number?: number; // number of the week (trace, count and color)
  addTo?: 5 | 10; // Kindergarten later weeks: addition within 5 or 10 instead of a number
  family?: string; // "at"
  families?: string[]; // vowel review weeks
  sightWords: string[];
}

export interface Plan {
  level: Level;
  label: string; // "Pre-K"
  ages: string; // "ages 3 to 5"
  weeks: Week[];
}

// Letters in a common phonics order (the sounds that build the most short words come first), not A to Z.
export const LETTER_ORDER = ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd', 'g', 'o', 'u', 'l', 'f', 'b', 'j', 'z', 'w', 'v', 'y', 'x', 'q'];

export const FAMILIES: Record<string, string[]> = {
  at: ['cat', 'bat', 'hat', 'mat', 'rat', 'sat'],
  an: ['can', 'fan', 'man', 'pan', 'ran', 'van'],
  ap: ['cap', 'map', 'nap', 'tap', 'lap'],
  ag: ['bag', 'rag', 'tag', 'wag'],
  ig: ['big', 'dig', 'pig', 'wig', 'fig'],
  it: ['bit', 'hit', 'sit', 'fit', 'kit'],
  in: ['bin', 'fin', 'pin', 'tin', 'win'],
  ip: ['dip', 'hip', 'lip', 'sip', 'zip'],
  op: ['hop', 'mop', 'pop', 'top'],
  ot: ['cot', 'dot', 'hot', 'lot', 'pot'],
  og: ['dog', 'fog', 'hog', 'jog', 'log'],
  ug: ['bug', 'hug', 'jug', 'mug', 'rug', 'tug'],
  un: ['bun', 'fun', 'run', 'sun'],
  ut: ['but', 'cut', 'hut', 'nut'],
  en: ['hen', 'men', 'pen', 'ten', 'den'],
  et: ['get', 'jet', 'net', 'pet', 'wet'],
  ed: ['bed', 'fed', 'red', 'led'],
};
const VOWEL_SETS: { vowel: string; families: string[] }[] = [
  { vowel: 'a', families: ['at', 'an', 'ap', 'ag'] },
  { vowel: 'i', families: ['ig', 'it', 'in', 'ip'] },
  { vowel: 'o', families: ['op', 'ot', 'og'] },
  { vowel: 'u', families: ['ug', 'un', 'ut'] },
  { vowel: 'e', families: ['en', 'et', 'ed'] },
];

const sightLevel = (slug: string) => (sightData as { slug: string; words: string[] }[]).find((s) => s.slug === slug)?.words ?? [];
const caseWord = (w: string) => (w === 'I' ? w : w.toLowerCase());

/** Pre-K: a name week, then 26 letters in groups of three with a review week after each group (36 weeks). */
function preKWeeks(): Week[] {
  const weeks: Week[] = [];
  const num = (n: number) => (n <= 20 ? Math.ceil(n / 2) : 10 + Math.ceil(((n - 20) * 10) / 16));
  const push = (w: Omit<Week, 'n' | 'number' | 'sightWords'>) => {
    const n = weeks.length + 1;
    weeks.push({ ...w, n, number: num(n), sightWords: [] });
  };
  push({ kind: 'name', title: 'My name', letters: [] });
  for (let i = 0; i < LETTER_ORDER.length; i += 3) {
    const group = LETTER_ORDER.slice(i, i + 3);
    for (const l of group) push({ kind: 'letter', title: `Letter ${l.toUpperCase()}`, letters: [l] });
    push({ kind: 'review', title: `Review: ${group.map((l) => l.toUpperCase()).join(', ')}`, letters: group });
  }
  return weeks;
}

/** Kindergarten: a name week, two letters a week for 13 weeks, then word families with a review after each vowel. */
function kWeeks(): Week[] {
  const weeks: Week[] = [];
  const sight = [...sightLevel('pre-k'), ...sightLevel('kindergarten')].map(caseWord);
  let s = 0;
  const nextSight = (count: number) => {
    const out = sight.slice(s, s + count);
    s += count;
    return out;
  };
  const mathFor = (n: number): Pick<Week, 'number' | 'addTo'> => (n <= 21 ? { number: n - 1 } : { addTo: n <= 28 ? 5 : 10 });
  const push = (w: Omit<Week, 'n' | 'number' | 'addTo'>) => {
    const n = weeks.length + 1;
    weeks.push({ ...w, n, ...mathFor(n) });
  };
  push({ kind: 'name', title: 'My name', letters: [], sightWords: nextSight(2) });
  for (let i = 0; i < LETTER_ORDER.length; i += 2) {
    const pair = LETTER_ORDER.slice(i, i + 2);
    push({ kind: 'letter', title: `Letters ${pair.map((l) => l.toUpperCase()).join(' and ')}`, letters: pair, sightWords: nextSight(3) });
  }
  for (const set of VOWEL_SETS) {
    for (const fam of set.families) push({ kind: 'family', title: `Word family -${fam}`, letters: [], family: fam, sightWords: nextSight(2) });
    push({ kind: 'vowel-review', title: `Short ${set.vowel} review`, letters: [set.vowel], families: set.families, sightWords: [] });
  }
  return weeks;
}

export const PLANS: Record<Level, Plan> = {
  'pre-k': { level: 'pre-k', label: 'Pre-K', ages: 'ages 3 to 5', weeks: preKWeeks() },
  kindergarten: { level: 'kindergarten', label: 'Kindergarten', ages: 'ages 5 to 6', weeks: kWeeks() },
};

/** The Pre-K week that teaches a letter (letter of the week pages link straight to it). */
export const preKWeekForLetter = (l: string) => PLANS['pre-k'].weeks.find((w) => w.kind === 'letter' && w.letters[0] === l)!;

/** One line describing what a week covers, for the plan tables. */
export function weekSummary(w: Week): string {
  const parts: string[] = [];
  if (w.kind === 'name') parts.push('Name tracing, name coloring page, letters in their name');
  if (w.kind === 'letter') parts.push(w.letters.length === 1 ? `Trace, find and color ${w.letters[0].toUpperCase()} ${w.letters[0]}` : `Trace and find ${w.letters.map((l) => `${l.toUpperCase()} ${l}`).join(' and ')}, beginning-sound words`);
  if (w.kind === 'review') parts.push(`Letter hunt and tracing for ${w.letters.map((l) => l.toUpperCase()).join(', ')}`);
  if (w.kind === 'family') parts.push(`Read, find and trace ${FAMILIES[w.family!].slice(0, 3).join(', ')}`);
  if (w.kind === 'vowel-review') parts.push(`Mixed word hunt: ${w.families!.map((f) => `-${f}`).join(', ')}`);
  if (w.number !== undefined) parts.push(`number ${w.number}`);
  if (w.addTo) parts.push(`adding within ${w.addTo}`);
  if (w.sightWords.length) parts.push(`sight words: ${w.sightWords.join(', ')}`);
  return parts.join('; ');
}

// ---------- Page helpers ----------

const M = 40;
const INK = COLORS.ink;
const f2 = (n: number) => Math.round(n * 100) / 100;

function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

/** Rough Helvetica width, good enough to wrap short lines of text on a page. */
const textW = (t: string, size: number) => {
  let u = 0;
  for (const ch of t) u += /[il.,'!|:;]/.test(ch) ? 0.26 : /[mwMW]/.test(ch) ? 0.84 : /[A-Z]/.test(ch) ? 0.66 : ch === ' ' ? 0.28 : 0.53;
  return u * size;
};
function wrap(t: string, size: number, maxW: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of t.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && textW(next, size) > maxW) { out.push(cur); cur = word; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}
/** Draws wrapped text and returns the y below it. */
function para(items: Item[], t: string, x: number, y: number, size: number, maxW: number, color = INK): number {
  for (const line of wrap(t, size, maxW)) {
    items.push({ kind: 'text', x, y, size, text: line, color, align: 'left' });
    y += size * 1.35;
  }
  return y;
}

function header(items: Item[], w: number) {
  items.push({ kind: 'text', x: M, y: 56, size: 11, text: 'Name', color: INK, align: 'left' });
  items.push({ kind: 'line', x1: M + 36, y1: 58, x2: M + 250, y2: 58, color: COLORS.quiet, width: 0.75 });
  items.push({ kind: 'text', x: w - M - 168, y: 56, size: 11, text: 'Date', color: INK, align: 'left' });
  items.push({ kind: 'line', x1: w - M - 136, y1: 58, x2: w - M, y2: 58, color: COLORS.quiet, width: 0.75 });
}
function footer(items: Item[], w: number, h: number, credit: boolean, label: string) {
  items.push({ kind: 'text', x: w - M, y: h - M + 14, size: 8, text: label, color: COLORS.quiet, align: 'right' });
  if (credit) items.push({ kind: 'text', x: M, y: h - M + 14, size: 8, text: `Free printable from ${SITE.domain}`, color: COLORS.quiet, align: 'left' });
}
/** A short instruction line for the grown-up, under the Name/Date header. */
function instruction(items: Item[], w: number, title: string, note?: string): number {
  items.push({ kind: 'text', x: M, y: 96, size: 20, text: title, color: INK, align: 'left' });
  return note ? para(items, note, M, 118, 11, w - 2 * M, COLORS.quiet) + 6 : 116;
}

function circlePath(cx: number, cy: number, r: number) {
  const k = 0.5523 * r;
  return `M${f2(cx + r)} ${f2(cy)} C${f2(cx + r)} ${f2(cy + k)} ${f2(cx + k)} ${f2(cy + r)} ${f2(cx)} ${f2(cy + r)} C${f2(cx - k)} ${f2(cy + r)} ${f2(cx - r)} ${f2(cy + k)} ${f2(cx - r)} ${f2(cy)} C${f2(cx - r)} ${f2(cy - k)} ${f2(cx - k)} ${f2(cy - r)} ${f2(cx)} ${f2(cy - r)} C${f2(cx + k)} ${f2(cy - r)} ${f2(cx + r)} ${f2(cy - k)} ${f2(cx + r)} ${f2(cy)} Z`;
}
function starPath(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${f2(cx + rr * Math.cos(a))} ${f2(cy + rr * Math.sin(a))}`);
  }
  return `M${pts.join(' L')} Z`;
}
function heartPath(cx: number, cy: number, r: number) {
  const t = cy - r * 0.35;
  return `M${f2(cx)} ${f2(cy + r * 0.9)} C${f2(cx - r * 1.3)} ${f2(cy + r * 0.1)} ${f2(cx - r * 0.9)} ${f2(t - r * 0.75)} ${f2(cx)} ${f2(t)} C${f2(cx + r * 0.9)} ${f2(t - r * 0.75)} ${f2(cx + r * 1.3)} ${f2(cy + r * 0.1)} ${f2(cx)} ${f2(cy + r * 0.9)} Z`;
}
const box = (x: number, y: number, w: number, h: number, r = 6) =>
  `M${f2(x + r)} ${f2(y)} H${f2(x + w - r)} Q${f2(x + w)} ${f2(y)} ${f2(x + w)} ${f2(y + r)} V${f2(y + h - r)} Q${f2(x + w)} ${f2(y + h)} ${f2(x + w - r)} ${f2(y + h)} H${f2(x + r)} Q${f2(x)} ${f2(y + h)} ${f2(x)} ${f2(y + h - r)} V${f2(y + r)} Q${f2(x)} ${f2(y)} ${f2(x + r)} ${f2(y)} Z`;

/** Solid letters (or short words) centered in a cell, for hunt grids. */
function centered(items: Item[], text: string, cx: number, yBase: number, cap: number) {
  const wdt = layoutWord(text).width * cap;
  drawText(items, text, cx - wdt / 2, yBase, cap, 'model', false);
}

// ---------- The pages in a pack ----------

export interface PackOptions {
  level: Level;
  week: Week;
  name: string; // may be empty
  paper: Paper;
  credit: boolean;
  bubble: LoadedFont | null; // bubble letter font for coloring pages; skipped while it loads
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

interface Planned { day: number; title: string; how: string; page: (o: PackOptions) => Page | Page[] | null }

/** A plan page for the grown-up: what to do each day, in about 15 minutes, plus ideas away from the paper. */
function planPage(o: PackOptions, plan: Planned[], label: string): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  const P = PLANS[o.level];
  const who = styleName(o.name, 'capital');
  items.push({ kind: 'text', x: M, y: 58, size: 11, text: `${P.label} at home, week ${o.week.n} of ${P.weeks.length}`, color: COLORS.quiet, align: 'left' });
  items.push({ kind: 'text', x: M, y: 92, size: 26, text: who ? `${who}'s week: ${o.week.title}` : `This week: ${o.week.title}`, color: INK, align: 'left' });
  let y = para(items, 'About 15 minutes a day. Do one page each day, and stop while it is still fun. Tick each box when you finish.', M, 116, 12, w - 2 * M, COLORS.quiet) + 10;

  for (const d of plan) {
    items.push({ kind: 'path', d: box(M, y - 14, 16, 16, 3), color: INK, width: 1.2 });
    items.push({ kind: 'text', x: M + 26, y, size: 13, text: `${DAYS[d.day]}: ${d.title}`, color: INK, align: 'left' });
    y = para(items, d.how, M + 26, y + 17, 11, w - 2 * M - 26, COLORS.quiet) + 12;
  }

  const ideas = offPageIdeas(o.week);
  if (ideas.length) {
    y += 6;
    items.push({ kind: 'line', x1: M, y1: y - 8, x2: w - M, y2: y - 8, color: COLORS.desc, width: 1 });
    items.push({ kind: 'text', x: M, y: y + 12, size: 13, text: 'Away from the paper', color: INK, align: 'left' });
    y += 30;
    for (const idea of ideas) {
      items.push({ kind: 'dot', cx: M + 4, cy: y - 4, r: 2, color: INK });
      y = para(items, idea, M + 14, y, 11, w - 2 * M - 14) + 4;
    }
  }
  footer(items, w, h, o.credit, label);
  return { w, h, items };
}

const letterInfo = (l: string) => (lettersData as { letter: string; words: string[]; tip: string }[]).find((x) => x.letter === l)!;
const shortWords = (l: string) => letterInfo(l).words.filter((w) => /^[a-z]+$/.test(w) && w.length <= 7 && w.startsWith(l));

function offPageIdeas(w: Week): string[] {
  if (w.kind === 'name') return [
    'Write their name on a sticky note and put it on their cup, chair or door. Point to it each day.',
    'Build the name with magnetic letters, blocks or play dough, then mix it up and build it again.',
    'Clap the parts of their name, then clap the names of people in the family.',
  ];
  if (w.kind === 'letter' || w.kind === 'review') {
    const ls = w.letters;
    const l = ls[0];
    const words = shortWords(l).slice(0, 3);
    const out = [
      `Go on a sound hunt around the house for things that start with ${ls.map((x) => `/${x}/`).join(' or ')}${words.length ? `, like ${words.join(', ')}` : ''}.`,
      `Write a big ${ls.map((x) => x.toUpperCase()).join(', ')} in a tray of salt, rice or shaving cream and trace it with one finger.`,
    ];
    if (w.kind === 'letter' && ls.length === 1) out.push(letterInfo(l).tip);
    else out.push('Read a picture book together and stop to point at each focus letter you spot.');
    return out;
  }
  if (w.kind === 'family') {
    const words = FAMILIES[w.family!];
    return [
      `Write -${w.family} on a card. Hold a letter in front of it and read the new word together (${words.slice(0, 3).join(', ')}).`,
      `Say a word and ask if it rhymes with ${words[0]}. Mix in a few that don't.`,
      'Point to the sight words of the week in a book you already read together.',
    ];
  }
  if (w.kind === 'vowel-review') return [
    `Make word cards for -${w.families!.join(', -')} and sort them into piles by ending.`,
    'Read the word hunt page out loud together before circling.',
  ];
  return [];
}

/** Letter tracing: capital and lowercase on handwriting lines. */
const letterTracePage = (l: string, label: string) => (o: PackOptions) => {
  const U = l.toUpperCase();
  const p = buildSheet({ name: '', style: 'capital', size: o.level === 'pre-k' ? 'large' : 'medium', paper: o.paper, practice: 'trace-write', startDots: true, modelRow: true, credit: false, rowTexts: [`${U} ${l}`, U, l] });
  footer(p.items, p.w, p.h, o.credit, label);
  return p;
};
/** Several letters mixed on one sheet, for review weeks. */
const mixedTracePage = (ls: string[], label: string) => (o: PackOptions) => {
  const pairs = ls.map((l) => `${l.toUpperCase()} ${l}`);
  const p = buildSheet({ name: '', style: 'capital', size: 'large', paper: o.paper, practice: 'trace', startDots: true, modelRow: true, credit: false, rowTexts: [pairs[0], ...pairs] });
  footer(p.items, p.w, p.h, o.credit, label);
  return p;
};
const namePage = (label: string) => (o: PackOptions) => {
  const p = buildSheet({ name: o.name, style: 'capital', size: o.level === 'pre-k' ? 'large' : 'medium', paper: o.paper, practice: 'trace-write', startDots: true, modelRow: true, credit: false });
  footer(p.items, p.w, p.h, o.credit, label);
  return p;
};
const numberPage = (n: number, label: string) => (o: PackOptions) => {
  const p = buildSheet({ name: '', style: 'capital', size: 'large', paper: o.paper, practice: 'trace-write', startDots: true, modelRow: true, credit: false, rowTexts: [String(n)] });
  footer(p.items, p.w, p.h, o.credit, label);
  return p;
};
const coloringPage = (text: string, label: string, caps: boolean) => (o: PackOptions) => {
  if (!o.bubble) return null;
  const p = buildColoringPage(o.bubble, { name: text, theme: 'stars', paper: o.paper, credit: false, caps });
  footer(p.items, p.w, p.h, o.credit, label);
  return p;
};

/** A grid of letters (or short words). The child circles every target. */
export function huntPage(o: PackOptions, targets: string[], pool: string[], title: string, note: string, label: string, seed: string): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  header(items, w);
  const top = instruction(items, w, title, note);
  const words = targets.some((t) => t.length > 1);
  const cols = words ? 3 : 5;
  const rows = words ? 6 : 6;
  const gridTop = top + 10;
  const gridBottom = h - M - 30;
  const cellW = (w - 2 * M) / cols;
  const cellH = (gridBottom - gridTop) / rows;
  const rand = rng(seed);
  const cells: string[] = [];
  const total = cols * rows;
  const nTarget = Math.round(total * 0.4);
  for (let i = 0; i < total; i++) {
    const pickFrom = i < nTarget ? targets : pool;
    cells.push(pickFrom[Math.floor(rand() * pickFrom.length)]);
  }
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const cap = words ? Math.min(40, cellH * 0.42) : Math.min(58, cellH * 0.5);
  cells.forEach((t, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const cx = M + c * cellW + cellW / 2;
    const cy = gridTop + r * cellH + cellH / 2;
    const fit = Math.min(cap, (cellW * 0.8) / Math.max(0.1, layoutWord(t).width));
    centered(items, t, cx, cy + fit * 0.35, fit);
  });
  footer(items, w, h, o.credit, label);
  return { w, h, items };
}

/** Number of the week: trace it, count the dots in a ten frame, color that many stars. */
export function countPage(o: PackOptions, n: number, label: string): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  header(items, w);
  let y = instruction(items, w, `The number ${n}`, `Trace ${n}. Count the dots. Then color ${n} ${n === 1 ? 'star' : 'stars'}.`);
  const cap = 54;
  drawCell(items, String(n), M, w - M, y + 6, cap, { practice: 'trace-write', startDots: true, model: true });
  y += 6 + cap * 1.5 + 30;

  // Ten frames: two rows of five boxes each, as many frames as the number needs.
  const frames = Math.max(1, Math.ceil(n / 10));
  const cell = Math.min(40, (w - 2 * M - (frames - 1) * 24) / (frames * 5));
  const frameW = cell * 5;
  const startX = (w - (frames * frameW + (frames - 1) * 24)) / 2;
  let dots = n;
  for (let f = 0; f < frames; f++) {
    const fx = startX + f * (frameW + 24);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
      const x = fx + c * cell, yy = y + r * cell;
      items.push({ kind: 'path', d: `M${f2(x)} ${f2(yy)} H${f2(x + cell)} V${f2(yy + cell)} H${f2(x)} Z`, color: INK, width: 1.4 });
      if (dots > 0) { items.push({ kind: 'dot', cx: x + cell / 2, cy: yy + cell / 2, r: cell * 0.3, color: '#5b86d9' }); dots--; }
    }
  }
  y += cell * 2 + 22;
  items.push({ kind: 'text', x: w / 2, y, size: 12, text: 'How many dots? Write the number in the box.', color: COLORS.quiet, align: 'center' });
  items.push({ kind: 'path', d: box(w / 2 - 30, y + 10, 60, 50), color: INK, width: 1.4 });
  y += 90;

  const per = n > 10 ? 10 : 10;
  const stars = n > 10 ? 20 : 10;
  const r = 15;
  const gapX = (w - 2 * M) / per;
  for (let i = 0; i < stars; i++) {
    const c = i % per, row = Math.floor(i / per);
    items.push({ kind: 'path', d: starPath(M + gapX * c + gapX / 2, y + row * 44 + r, r), color: INK, width: 1.4, fill: '#ffffff' });
  }
  footer(items, w, h, o.credit, label);
  return { w, h, items };
}

/** Adding with dots: six problems, sums up to `max`. */
export function additionPage(o: PackOptions, max: 5 | 10, label: string, seed: string): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  header(items, w);
  const top = instruction(items, w, `Adding within ${max}`, 'Count the dots in each group, then write how many in all.');
  const rand = rng(seed);
  const probs: [number, number][] = [];
  while (probs.length < 6) {
    const a = 1 + Math.floor(rand() * (max - 1));
    const b = 1 + Math.floor(rand() * (max - a));
    if (!probs.some(([x, y]) => x === a && y === b)) probs.push([a, b]);
  }
  const rowH = (h - M - 30 - top) / 6;
  const cap = Math.min(36, rowH * 0.38);
  const span = w - 2 * M;
  probs.forEach(([a, b], i) => {
    const yTop = top + rowH * i;
    const yMid = yTop + rowH * 0.62;
    const base = yMid + cap * 0.5;
    // Dots sit above each number, five to a row, so kids can count them.
    const dotGroup = (count: number, cx: number) => {
      const r = 6.5, gap = 17;
      const perRow = Math.min(5, count);
      for (let k = 0; k < count; k++) {
        const col = k % 5, row = Math.floor(k / 5);
        const x = cx - ((perRow - 1) * gap) / 2 + col * gap;
        items.push({ kind: 'path', d: circlePath(x, yMid - cap * 0.7 - 16 - row * gap, r), color: INK, width: 1.2, fill: '#ffffff' });
      }
    };
    const num = (n: number, cx: number) => { centered(items, String(n), cx, base, cap); dotGroup(n, cx); };
    const xA = M + span * 0.14, xPlus = M + span * 0.31, xB = M + span * 0.48, xEq = M + span * 0.64, xBox = M + span * 0.8;
    num(a, xA);
    items.push({ kind: 'line', x1: xPlus - 12, y1: yMid, x2: xPlus + 12, y2: yMid, color: INK, width: 3 });
    items.push({ kind: 'line', x1: xPlus, y1: yMid - 12, x2: xPlus, y2: yMid + 12, color: INK, width: 3 });
    num(b, xB);
    items.push({ kind: 'line', x1: xEq - 12, y1: yMid - 6, x2: xEq + 12, y2: yMid - 6, color: INK, width: 3 });
    items.push({ kind: 'line', x1: xEq - 12, y1: yMid + 6, x2: xEq + 12, y2: yMid + 6, color: INK, width: 3 });
    items.push({ kind: 'path', d: box(xBox - cap * 0.8, yMid - cap * 0.8, cap * 1.6, cap * 1.6), color: INK, width: 1.4 });
  });
  footer(items, w, h, o.credit, label);
  return { w, h, items };
}

/** Words on handwriting lines (beginning-sound words, word families, sight words). */
const wordsPage = (lines: string[], label: string) => (o: PackOptions) => {
  // Short lists repeat so the page is full of practice; long lists stop at what fits on one page.
  const rows = lines.length >= 6 ? lines : Array.from({ length: Math.ceil(6 / lines.length) * lines.length }, (_, i) => lines[i % lines.length]);
  const pages = buildWordPages({ lines: rows.slice(0, 8), size: 'medium', paper: o.paper, practice: 'trace', startDots: true, model: true, credit: false });
  for (const p of pages) footer(p.items, p.w, p.h, o.credit, label);
  return pages.slice(0, 1);
};

const ALPHA = 'abcdefghijklmnopqrstuvwxyz'.split('');
/** Letters to mix in around the targets. Mirror-image letters (b d p q) are left out, so a hunt for b isn't a trick. */
const distractors = (ls: string[]) => ALPHA.filter((x) => !ls.includes(x) && !'bdpq'.includes(x));

/** The day-by-day plan for a week, which also lists the pages in the pack, in order. */
function planFor(level: Level, w: Week): Planned[] {
  const label = `Week ${w.n}: ${w.title}`;
  const both = (l: string) => [l.toUpperCase(), l];
  const mathDay: Planned = w.addTo
    ? { day: 3, title: `Adding within ${w.addTo}`, how: 'Use real objects first (blocks, crackers, toy cars) to act out a problem or two, then do the page together.', page: (o) => additionPage(o, w.addTo!, label, `${level}-${w.n}`) }
    : { day: 3, title: `The number ${w.number}`, how: `Trace ${w.number}, count the dots out loud, then color ${w.number} ${w.number === 1 ? 'star' : 'stars'}. Count real things too: steps, spoons, socks.`, page: (o) => countPage(o, w.number!, label) };

  if (w.kind === 'name') return [
    { day: 0, title: 'Trace their name', how: 'Say each letter as they trace it. Green dots show where each stroke starts.', page: namePage(label) },
    { day: 1, title: 'Find the letters in their name', how: 'Circle every letter from their name. Say the letter name each time.', page: (o) => {
      const letters = [...new Set(o.name.toLowerCase().replace(/[^a-z]/g, '').split(''))];
      const targets = letters.length ? letters.flatMap(both) : ['A', 'a'];
      const pool = ALPHA.filter((x) => !letters.includes(x)).flatMap(both);
      return huntPage(o, targets, pool, 'Find the letters in my name', letters.length ? `Circle every ${letters.map((l) => l.toUpperCase()).join(', ')}.` : 'Type a name above to fill this page with the letters in it.', label, `name-${o.name}`);
    } },
    { day: 2, title: 'Color their name', how: 'Color the big bubble letters of their name. Talk about the first letter and its sound.', page: (o) => coloringPage(styleName(o.name, 'capital') || 'Name', label, true)(o) },
    mathDay,
    { day: 4, title: level === 'pre-k' ? 'Trace their name again' : 'Sight words', how: level === 'pre-k' ? 'Same page as Monday. Notice how much steadier the lines are by Friday.' : `Trace ${w.sightWords.join(' and ')}. Read each one out loud together.`, page: level === 'pre-k' ? namePage(label) : wordsPage(w.sightWords, label) },
  ];

  if (w.kind === 'letter' && level === 'pre-k') {
    const l = w.letters[0];
    return [
      { day: 0, title: `Trace ${l.toUpperCase()} and ${l}`, how: `Say the sound /${l}/ each time they trace. Green dots show where to start.`, page: letterTracePage(l, label) },
      { day: 1, title: `Find ${l.toUpperCase()} and ${l}`, how: `Circle every ${l.toUpperCase()} and ${l}. Point to each one and say its sound.`, page: (o) => huntPage(o, both(l), distractors([l]).flatMap(both), `Find ${l.toUpperCase()} and ${l}`, `Circle every capital ${l.toUpperCase()} and lowercase ${l}.`, label, `pk-${w.n}`) },
      { day: 2, title: `Color ${l.toUpperCase()} and ${l}`, how: `Color the bubble letters. Name things that start with /${l}/ while they color: ${shortWords(l).slice(0, 3).join(', ')}.`, page: coloringPage(`${l.toUpperCase()}${l}`, label, false) },
      mathDay,
      { day: 4, title: 'Trace their name', how: `Trace their name, then look for ${l.toUpperCase()} or ${l} in it together.`, page: namePage(label) },
    ];
  }

  if (w.kind === 'letter') {
    const [a, b] = w.letters;
    const words = [...shortWords(a).slice(0, 3), ...shortWords(b).slice(0, 3)];
    return [
      { day: 0, title: `Trace ${a.toUpperCase()} ${a}`, how: `Say /${a}/ as they trace. Then think of three words that start with it.`, page: letterTracePage(a, label) },
      { day: 1, title: `Trace ${b.toUpperCase()} ${b}`, how: `Say /${b}/ as they trace. Then think of three words that start with it.`, page: letterTracePage(b, label) },
      { day: 2, title: 'Letter hunt and words', how: `Circle every ${a} and ${b} on the hunt page, then trace the words that start with them.`, page: (o) => [huntPage(o, [...both(a), ...both(b)], distractors([a, b]).flatMap(both), `Find ${a.toUpperCase()} ${a} and ${b.toUpperCase()} ${b}`, `Circle every ${a.toUpperCase()}, ${a}, ${b.toUpperCase()} and ${b}.`, label, `k-${w.n}`), ...wordsPage(words, label)(o)] },
      mathDay,
      { day: 4, title: 'Sight words and name', how: `Trace ${w.sightWords.join(', ')}, then trace their name.`, page: (o) => [...wordsPage(w.sightWords, label)(o), namePage(label)(o)] },
    ];
  }

  if (w.kind === 'review') return [
    { day: 0, title: 'Letter hunt', how: `Circle every ${w.letters.map((l) => l.toUpperCase()).join(', ')} you can find, capital and lowercase. Say each sound.`, page: (o) => huntPage(o, w.letters.flatMap(both), distractors(w.letters).flatMap(both), `Find ${w.letters.map((l) => l.toUpperCase()).join(', ')}`, 'Circle the letters from the last three weeks, capital and lowercase.', label, `pk-${w.n}`) },
    { day: 1, title: 'Trace all three', how: 'Trace each pair, saying the letter name and its sound.', page: mixedTracePage(w.letters, label) },
    { day: 2, title: 'Color the letters', how: 'Color the bubble letters and name a word for each one.', page: coloringPage(w.letters.map((l) => l.toUpperCase()).join(''), label, true) },
    mathDay,
    { day: 4, title: 'Trace their name', how: 'Trace their name. Is one of this week\'s letters in it?', page: namePage(label) },
  ];

  if (w.kind === 'family') {
    const fam = w.family!;
    const words = FAMILIES[fam];
    const others = Object.entries(FAMILIES).filter(([k]) => k !== fam).flatMap(([, v]) => v.slice(0, 2));
    return [
      { day: 0, title: `Read -${fam} words`, how: `Read ${words.join(', ')} together. Point out that only the first sound changes.`, page: wordsPage(words, label) },
      { day: 1, title: `Find the -${fam} words`, how: `Read each word out loud, then circle the ones that end in -${fam}.`, page: (o) => huntPage(o, words, others, `Find the -${fam} words`, `Read each word. Circle the words that end in -${fam}.`, label, `fam-${fam}`) },
      { day: 2, title: 'Sight words', how: `Trace ${w.sightWords.join(' and ')}, then find them in a book.`, page: wordsPage(w.sightWords, label) },
      mathDay,
      { day: 4, title: 'Trace their name', how: 'Trace their name. Can they think of a word that rhymes with it?', page: namePage(label) },
    ];
  }

  // Short vowel review.
  const fams = w.families!;
  const targets = fams.flatMap((f) => FAMILIES[f].slice(0, 3));
  const others = Object.entries(FAMILIES).filter(([k]) => !fams.includes(k)).flatMap(([, v]) => v.slice(0, 2));
  return [
    { day: 0, title: `Short ${w.letters[0]} word hunt`, how: `Read every word, then circle the ones with a short ${w.letters[0]} sound.`, page: (o) => huntPage(o, targets, others, `Find the short ${w.letters[0]} words`, `Circle every word with the short ${w.letters[0]} sound.`, label, `vr-${w.n}`) },
    { day: 1, title: 'Trace and read', how: 'Trace the words, reading each one aloud.', page: wordsPage(targets.slice(0, 8), label) },
    { day: 2, title: 'Color the vowel', how: `Color the big ${w.letters[0]} and name three words with its short sound.`, page: coloringPage(`${w.letters[0].toUpperCase()}${w.letters[0]}`, label, false) },
    mathDay,
    { day: 4, title: 'Trace their name', how: 'Trace their name, then write it once more on the back with no tracing.', page: namePage(label) },
  ];
}

/** Every page of a week's pack, plan page first. Coloring pages are left out until the bubble font loads. */
export function buildWeekPack(o: PackOptions): Page[] {
  const plan = planFor(o.level, o.week);
  const label = `Week ${o.week.n}: ${o.week.title}`;
  const pages: Page[] = [planPage(o, plan, label)];
  for (const d of plan) {
    const p = d.page(o);
    if (!p) continue;
    pages.push(...(Array.isArray(p) ? p : [p]));
  }
  return pages;
}

/** The plan as plain text, for the static pages (no child's name needed). */
export function dayPlan(level: Level, w: Week): { day: string; title: string; how: string }[] {
  return planFor(level, w).map((d) => ({ day: DAYS[d.day], title: d.title, how: d.how }));
}
