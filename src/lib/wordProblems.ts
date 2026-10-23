// Kindergarten word problems: short read-aloud story problems within 5 or 10, with theme pictures to count
// (farm, dinosaurs, ocean ...), and a number sentence to fill in. Used by /math-worksheets/kindergarten-word-problems/.
// Same page model as the other makers: everything is drawn in the browser, and the child's name (which can appear
// in the problems) never leaves the device.
import { PAPER, COLORS, styleName, type Item, type Page, type Paper } from './sheet';
import { M, rng, header, footer, instruction, para, circlePath, starPath, box } from './homeschool';
import { THEMES, iconKind, iconPath, type ThemeIcon } from './program/themes';
import type { ThemeId } from './program/types';

export type WPKind = 'wp-add' | 'wp-subtract' | 'wp-mixed' | 'wp-draw';
export type WPRange = 5 | 10;

export interface WPOptions {
  kind: WPKind;
  range: WPRange;
  theme: ThemeId;
  name: string; // may be empty; printed on the Name line and used in the problems
  paper: Paper;
  credit: boolean;
  seed: number; // "New problems" bumps this
  label?: string; // footer label override
}

export const WP_KINDS: { v: WPKind; label: string; sub: string }[] = [
  { v: 'wp-add', label: 'Addition word problems', sub: 'Count two groups of pictures, fill in the number sentence' },
  { v: 'wp-subtract', label: 'Subtraction word problems', sub: 'Some go away (they have an X). How many are left?' },
  { v: 'wp-mixed', label: 'Add or subtract?', sub: 'Listen to the story, then write + or - in the circle' },
  { v: 'wp-draw', label: 'Draw and solve', sub: 'No pictures: your child draws the story, then writes the answer' },
];

/** The themes offered on the free maker (the ones whose pictures read well in groups). */
export const WP_THEMES: { v: ThemeId; label: string }[] = [
  { v: 'farm', label: 'Farm animals' },
  { v: 'dinosaurs', label: 'Dinosaurs' },
  { v: 'ocean', label: 'Under the sea' },
  { v: 'bugs', label: 'Bugs' },
  { v: 'pets', label: 'Pets' },
  { v: 'jungle', label: 'Jungle animals' },
  { v: 'trucks', label: 'Trucks and cars' },
  { v: 'space', label: 'Space' },
];

const INK = COLORS.ink;
const CROSS = '#d9534f';
const f2 = (n: number) => Math.round(n * 100) / 100;

// ---------- Pictures ----------

/** Maps an icon's 0..1000 path into a size x size box centered at (cx, cy). */
function placePath(d: string, cx: number, cy: number, size: number): string {
  const s = size / 1000;
  const ox = cx - size / 2, oy = cy - size / 2;
  let i = 0;
  return d.replace(/-?\d+(?:\.\d+)?/g, (m) => f2(Number(m) * s + (i++ % 2 === 0 ? ox : oy)).toString());
}
/** A theme picture, or a plain star until the theme's pictures have loaded. */
function drawIcon(items: Item[], theme: ThemeId, id: string, cx: number, cy: number, size: number) {
  const d = iconPath(theme, id);
  if (d) items.push({ kind: 'path', d: placePath(d, cx, cy, size), color: INK, width: 0, fill: INK, evenOdd: true });
  else items.push({ kind: 'path', d: starPath(cx, cy, size * 0.42), color: INK, width: 1.4, fill: '#ffffff' });
}
/** n pictures in rows of perRow, centered on cx with the top at `top`. Pictures from crossFrom on get a red X. */
function group(items: Item[], theme: ThemeId, id: string, n: number, cx: number, top: number, size: number, perRow: number, crossFrom = Infinity) {
  const gap = size * 0.18;
  for (let k = 0; k < n; k++) {
    const r = Math.floor(k / perRow), c = k % perRow;
    const inRow = Math.min(perRow, n - r * perRow);
    const x = cx - ((inRow - 1) * (size + gap)) / 2 + c * (size + gap);
    const y = top + size / 2 + r * (size + gap);
    drawIcon(items, theme, id, x, y, size);
    if (k >= crossFrom) {
      const q = size * 0.42;
      items.push({ kind: 'line', x1: x - q, y1: y - q, x2: x + q, y2: y + q, color: CROSS, width: 2.4 });
      items.push({ kind: 'line', x1: x + q, y1: y - q, x2: x - q, y2: y + q, color: CROSS, width: 2.4 });
    }
  }
}
const groupW = (n: number, size: number, perRow: number) => Math.min(perRow, n) * size * 1.18 - size * 0.18;
const groupH = (n: number, size: number, perRow: number) => { const r = Math.ceil(n / perRow); return r * size + (r - 1) * size * 0.18; };
/** The biggest picture size for groups of `ns` side by side in a w x h area, with one row each or (when it is bigger) two rows. */
function fit(ns: number[], w: number, h: number): { s: number; per: number[] } {
  // One row up to 5; past 5, two even rows (6 is 3 and 3, 9 is 5 and 4), so no picture sits alone on a row.
  const per1 = ns.map((n) => (n <= 5 ? 5 : Math.ceil(n / 2)));
  const rows1 = Math.max(...ns.map((n, i) => Math.ceil(n / per1[i])));
  const one = Math.min(38, w / (ns.reduce((t, n, i) => t + Math.min(per1[i], n), 0) * 1.18), h / (rows1 + (rows1 - 1) * 0.18));
  // Two rows for every group, when that gives bigger pictures (short rows of small groups).
  const per2 = ns.map((n) => Math.max(1, Math.ceil(n / 2)));
  const two = Math.min(38, w / (per2.reduce((t, p) => t + p, 0) * 1.18), h / (ns.some((n) => n > 1) ? 2.18 : 1));
  return two > one * 1.15 ? { s: two, per: per2 } : { s: one, per: per1 };
}

/** Pictures the problems can count: no places (a barn can't walk away), not the buddy (it is a character), no duplicates. */
function countable(theme: ThemeId) {
  const T = THEMES[theme];
  const ok = T.icons.filter((i) => iconKind(theme, i) !== 'place' && i.id !== T.buddy.icon && !['unicorn-head', 'goldfish'].includes(i.id));
  return { animals: ok.filter((i) => iconKind(theme, i) === 'animal'), objects: ok.filter((i) => iconKind(theme, i) === 'object') };
}

// ---------- Problems ----------

export type WPProblem = { text: string; a: number; b: number; op: '+' | '-'; icon: string };

const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pl = (n: number, ic: ThemeIcon) => (n === 1 ? ic.one : ic.many);

/** Number pairs: adding has sums 2 to the range (3 and up within 10) and starts from 2 or more; taking away starts from 2 to the range and leaves at least 1. */
function pairsFor(rand: () => number, op: '+' | '-', range: WPRange, used: Set<string>): [number, number] {
  for (let guard = 0; ; guard++) {
    let a: number, b: number;
    if (op === '+') { const lo = range === 10 ? 3 : 2; const s = lo + Math.floor(rand() * (range - lo + 1)); a = s === 2 ? 1 : 2 + Math.floor(rand() * (s - 2)); b = s - a; } // a story starts with a group (2 or more), so pages don't all open with "There is 1"
    else { const lo = range === 10 ? 4 : 2; a = lo + Math.floor(rand() * (range - lo + 1)); b = 1 + Math.floor(rand() * (a - 1)); }
    const k = `${a}${op}${b}`;
    if (!used.has(k) || guard > 200) { used.add(k); return [a, b]; }
  }
}

/** The signs for a page: adding, taking away, or a mix that starts with adding and has both. */
function opsFor(kind: WPKind, count: number, rand: () => number): ('+' | '-')[] {
  if (kind === 'wp-add') return Array(count).fill('+');
  if (kind === 'wp-subtract') return Array(count).fill('-');
  const patterns = count === 3 ? ['+-+', '+--', '-+-'] : ['+-+-', '+--+', '++--'];
  return patterns[Math.floor(rand() * patterns.length)].split('') as ('+' | '-')[];
}

/** Story problems for one page. The child's name (or the theme's buddy) is the main character. */
export function makeProblems(o: Pick<WPOptions, 'kind' | 'range' | 'theme' | 'name' | 'seed'>, count: number): WPProblem[] {
  const T = THEMES[o.theme];
  const rand = rng(`wp-${o.kind}-${o.theme}-${o.range}-${o.seed}`);
  const who = styleName(o.name, 'capital').trim();
  const S = who || `the ${T.buddy.one}`; // who the story is about
  const other = who ? `the ${T.buddy.one}` : 'a friend';
  const again = who || 'it'; // second mention: the name again, or "it" for the buddy (no guessing a child's pronoun)
  const { animals, objects } = countable(o.theme);
  const used = new Set<string>();
  const shuffled = (l: ThemeIcon[]) => { const c = [...l]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c; };
  // Space has only a telescope to hold, and a bag of telescopes reads oddly: space problems count rockets, astronauts and aliens.
  const aPool = shuffled(animals), oPool = o.theme === 'space' ? [] : shuffled(objects);
  let ai = 0, oi = 0;
  return opsFor(o.kind, count, rand).map((op, i) => {
    const [a, b] = pairsFor(rand, op, o.range, used);
    // Mostly moving things (animals, trucks); objects for every third problem when the theme has them.
    const useObj = oPool.length > 0 && (aPool.length === 0 || i % 3 === 1);
    const ic = useObj ? oPool[oi++ % oPool.length] : aPool[ai++ % aPool.length];
    const v = Math.floor(rand() * 2);
    let text: string;
    if (op === '+') {
      text = useObj
        ? [
          `${cap1(S)} has ${a} ${pl(a, ic)}. ${cap1(again)} finds ${b} more. How many ${ic.many} does ${again} have now?`,
          `${cap1(S)} has ${a} ${pl(a, ic)}. ${cap1(other)} has ${b} ${pl(b, ic)}. How many ${ic.many} do they have in all?`,
        ][v]
        : [
          `${cap1(S)} sees ${a} ${pl(a, ic)} ${T.place}. Then ${b} more ${b === 1 ? 'comes' : 'come'} along. How many ${ic.many} are there now?`,
          `There ${a === 1 ? 'is' : 'are'} ${a} ${pl(a, ic)} ${T.place}. ${b} more ${b === 1 ? 'joins' : 'join'} ${a === 1 ? 'it' : 'them'}. How many ${ic.many} are there in all?`,
        ][v];
    } else {
      text = useObj
        ? [
          `${cap1(S)} has ${a} ${pl(a, ic)}. ${cap1(again)} gives ${b} to ${other}. How many ${ic.many} does ${again} have left?`,
          `There are ${a} ${pl(a, ic)} in a bag. ${cap1(S)} takes ${b} out. How many ${ic.many} are still in the bag?`,
        ][v]
        : [
          // ("At home" stories can't have anyone go home.)
          T.place === 'at home'
            ? `There are ${a} ${pl(a, ic)} ${T.place}. ${b} ${b === 1 ? 'goes' : 'go'} outside. How many ${ic.many} are still inside?`
            : `There are ${a} ${pl(a, ic)} ${T.place}. ${b} ${b === 1 ? 'goes' : 'go'} home. How many ${ic.many} are still there?`,
          `${cap1(S)} sees ${a} ${pl(a, ic)} ${T.place}. Then ${b} ${b === 1 ? 'goes' : 'go'} away. How many ${ic.many} are left?`,
        ][v];
    }
    return { text, a, b, op, icon: ic.id };
  });
}

// ---------- Drawing ----------

function signPlus(items: Item[], cx: number, cy: number, s = 8) {
  items.push({ kind: 'line', x1: cx - s, y1: cy, x2: cx + s, y2: cy, color: INK, width: 2.6 });
  items.push({ kind: 'line', x1: cx, y1: cy - s, x2: cx, y2: cy + s, color: INK, width: 2.6 });
}
function signMinus(items: Item[], cx: number, cy: number, s = 8) {
  items.push({ kind: 'line', x1: cx - s, y1: cy, x2: cx + s, y2: cy, color: INK, width: 2.6 });
}
function signEquals(items: Item[], cx: number, cy: number, s = 8) {
  items.push({ kind: 'line', x1: cx - s, y1: cy - 4, x2: cx + s, y2: cy - 4, color: INK, width: 2.6 });
  items.push({ kind: 'line', x1: cx - s, y1: cy + 4, x2: cx + s, y2: cy + 4, color: INK, width: 2.6 });
}

const BOX = 40, SIGN = 32;
const SENTENCE_W = 3 * BOX + 2 * SIGN;
/** The number sentence to fill in: [ ] + [ ] = [ ]. With sign 'blank' the middle is an empty circle for + or -. */
function sentence(items: Item[], x: number, cy: number, sign: '+' | '-' | 'blank') {
  items.push({ kind: 'path', d: box(x, cy - BOX / 2, BOX, BOX, 6), color: COLORS.desc, width: 1.3 });
  const s1 = x + BOX + SIGN / 2;
  if (sign === '+') signPlus(items, s1, cy);
  else if (sign === '-') signMinus(items, s1, cy);
  else items.push({ kind: 'path', d: circlePath(s1, cy, 10), color: INK, width: 1.4 });
  items.push({ kind: 'path', d: box(x + BOX + SIGN, cy - BOX / 2, BOX, BOX, 6), color: COLORS.desc, width: 1.3 });
  signEquals(items, x + 2 * BOX + SIGN * 1.5, cy);
  items.push({ kind: 'path', d: box(x + 2 * BOX + 2 * SIGN, cy - BOX / 2, BOX, BOX, 6), color: INK, width: 1.8 });
}

const TITLES: Record<WPKind, string> = {
  'wp-add': 'Addition word problems',
  'wp-subtract': 'Subtraction word problems',
  'wp-mixed': 'Add or subtract word problems',
  'wp-draw': 'Draw and solve',
};
const NOTES: Record<WPKind, string> = {
  'wp-add': 'Read each problem out loud together. Count the pictures in each group, then fill in the number sentence. The last box is the answer.',
  'wp-subtract': 'Read each problem out loud together. The pictures with an X went away. Fill in the number sentence. The last box is how many are left.',
  'wp-mixed': 'Read each problem out loud together. Does the group get bigger or smaller? Write + or - in the circle, then fill in the numbers. The last box is the answer.',
  'wp-draw': 'Read each problem out loud together. Draw the story in the box (circles are fine), then write the answer.',
};

const SHORT: Record<WPKind, string> = { 'wp-add': 'addition', 'wp-subtract': 'subtraction', 'wp-mixed': 'add or subtract', 'wp-draw': 'draw and solve' };
export const wpLabel = (o: Pick<WPOptions, 'kind' | 'range' | 'theme' | 'label'>) =>
  o.label ?? `Kindergarten word problems: ${SHORT[o.kind]}, ${THEMES[o.theme].short}, within ${o.range}`;

export function buildWordProblemPage(o: WPOptions): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  header(items, w);
  const who = styleName(o.name, 'capital');
  if (who) items.push({ kind: 'text', x: M + 44, y: 53, size: 14, text: who, color: INK, align: 'left' });
  const y0 = instruction(items, w, `${TITLES[o.kind]} within ${o.range}`, NOTES[o.kind]) + 6;
  const draw = o.kind === 'wp-draw';
  const count = draw ? 3 : 4;
  const list = makeProblems(o, count);
  const bottom = h - M - 26;
  const rowH = (bottom - y0) / count;
  const textX = M + 32;
  const textW = w - M - textX;
  const size = 14;
  list.forEach((p, i) => {
    const yT = y0 + rowH * i;
    if (i > 0) items.push({ kind: 'line', x1: M, y1: yT, x2: w - M, y2: yT, color: COLORS.desc, width: 0.8, dash: [3, 4] });
    // Number badge and the story.
    items.push({ kind: 'path', d: circlePath(M + 11, yT + 20, 11), color: INK, width: 1.3 });
    items.push({ kind: 'text', x: M + 11, y: yT + 24.5, size: 12, text: String(i + 1), color: INK, align: 'center' });
    const ty = para(items, p.text, textX, yT + 25, size, textW);
    // Below the story: pictures (or a box to draw in) on the left, the number sentence on the right.
    const areaTop = ty - 4;
    const areaH = yT + rowH - 12 - areaTop;
    const picW = w - M - textX - SENTENCE_W - 24;
    const midY = areaTop + areaH / 2;
    if (draw) {
      items.push({ kind: 'path', d: box(textX, areaTop, picW, areaH, 8), color: COLORS.desc, width: 1.2, dash: [5, 4] });
      items.push({ kind: 'text', x: textX + 10, y: areaTop + 16, size: 10, text: 'Draw it here', color: COLORS.quiet, align: 'left' });
      const ax = w - M - SENTENCE_W / 2 - 30;
      items.push({ kind: 'text', x: ax + 30, y: midY - 38, size: 12, text: 'Answer', color: INK, align: 'center' });
      items.push({ kind: 'path', d: box(ax, midY - 26, 60, 56, 8), color: INK, width: 1.8 });
      return;
    }
    if (p.op === '+') {
      const { s, per: [pa, pb] } = fit([p.a, p.b], picW - 34, areaH);
      const wa = groupW(p.a, s, pa), wb = groupW(p.b, s, pb);
      const x0 = textX + (picW - (wa + 34 + wb)) / 2;
      group(items, o.theme, p.icon, p.a, x0 + wa / 2, midY - groupH(p.a, s, pa) / 2, s, pa);
      if (o.kind !== 'wp-mixed') signPlus(items, x0 + wa + 17, midY, 7); // on the mixed page the story, not a sign, says what to do
      group(items, o.theme, p.icon, p.b, x0 + wa + 34 + wb / 2, midY - groupH(p.b, s, pb) / 2, s, pb);
    } else {
      const { s, per: [pa] } = fit([p.a], picW, areaH);
      group(items, o.theme, p.icon, p.a, textX + picW / 2, midY - groupH(p.a, s, pa) / 2, s, pa, p.a - p.b);
    }
    sentence(items, w - M - SENTENCE_W, midY, o.kind === 'wp-mixed' ? 'blank' : p.op);
  });
  footer(items, w, h, o.credit, wpLabel(o));
  return { w, h, items };
}

/** Several different pages (members print a short set at once). */
export function buildWordProblemSet(o: WPOptions, count: number): Page[] {
  return Array.from({ length: count }, (_, k) => buildWordProblemPage({ ...o, seed: o.seed + k * 7919 }));
}
