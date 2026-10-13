// Pre-K math worksheets: count and color, ten frames, count and circle, more or fewer, and missing numbers.
// Same page model as the tracing tools and the homeschool packs, so everything is drawn in the browser
// and the child's name (if typed) never leaves the device.
import { PAPER, COLORS, styleName, type Item, type Page, type Paper } from './sheet';
import { M, rng, header, footer, instruction, circlePath, starPath, heartPath, box, centered, countPage, PLANS } from './homeschool';

export type MathKind = 'count-color' | 'ten-frame' | 'count-circle' | 'more-less' | 'missing';
export type MathRange = 5 | 10 | 20;
export type Compare = 'more' | 'fewer';

export interface MathOptions {
  kind: MathKind;
  range: MathRange; // numbers 1 to range
  number: number; // count and color: the number of the page (1 to 20)
  compare: Compare; // more or fewer page
  name: string; // may be empty; printed on the Name line only
  paper: Paper;
  credit: boolean;
  seed: number; // "New problems" bumps this
}

export const MATH_KINDS: { v: MathKind; label: string; sub: string }[] = [
  { v: 'count-color', label: 'Count and color', sub: 'Trace a number, count a ten frame, color that many stars' },
  { v: 'ten-frame', label: 'Ten frames', sub: 'Count the dots in each frame and write how many' },
  { v: 'count-circle', label: 'Count and circle', sub: 'Count the shapes, circle the right number' },
  { v: 'more-less', label: 'More or fewer', sub: 'Circle the group with more (or fewer)' },
  { v: 'missing', label: 'Missing numbers', sub: 'Fill in the number that comes next' },
];

const INK = COLORS.ink;
const DOT = '#5b86d9';
const f2 = (n: number) => Math.round(n * 100) / 100;

type Shape = 'star' | 'heart' | 'circle' | 'square' | 'triangle';
const SHAPES: Shape[] = ['star', 'heart', 'circle', 'square', 'triangle'];
function shape(items: Item[], s: Shape, cx: number, cy: number, r: number) {
  const d =
    s === 'star' ? starPath(cx, cy, r * 1.1)
    : s === 'heart' ? heartPath(cx, cy + r * 0.1, r * 0.95)
    : s === 'circle' ? circlePath(cx, cy, r * 0.85)
    : s === 'square' ? `M${f2(cx - r * 0.78)} ${f2(cy - r * 0.78)} H${f2(cx + r * 0.78)} V${f2(cy + r * 0.78)} H${f2(cx - r * 0.78)} Z`
    : `M${f2(cx)} ${f2(cy - r * 0.95)} L${f2(cx + r)} ${f2(cy + r * 0.8)} L${f2(cx - r)} ${f2(cy + r * 0.8)} Z`;
  items.push({ kind: 'path', d, color: INK, width: 1.3, fill: '#ffffff' });
}

/** Name/Date header, with the child's name written on the line when one is typed. */
function top(items: Item[], w: number, name: string) {
  header(items, w);
  const who = styleName(name, 'capital');
  if (who) items.push({ kind: 'text', x: M + 44, y: 53, size: 14, text: who, color: INK, align: 'left' });
}

const rangeText = (r: MathRange) => `1 to ${r}`;
const labelFor = (o: MathOptions) => {
  const k = MATH_KINDS.find((x) => x.v === o.kind)!.label;
  return o.kind === 'count-color' ? `Pre-K math: ${k}, number ${o.number}` : `Pre-K math: ${k}, ${rangeText(o.range)}`;
};

/** n distinct numbers from 1..max (or fewer if the range is small), in random order. */
function pickNumbers(rand: () => number, max: number, count: number, min = 1): number[] {
  const pool = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const out: number[] = [];
  while (out.length < count) out.push(...pool.slice(0, count - out.length));
  return out;
}

/** A ten frame (2 rows of 5) with the first `dots` boxes filled, top row first. */
function tenFrame(items: Item[], x: number, y: number, cell: number, dots: number) {
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
    const xx = x + c * cell, yy = y + r * cell;
    items.push({ kind: 'path', d: `M${f2(xx)} ${f2(yy)} H${f2(xx + cell)} V${f2(yy + cell)} H${f2(xx)} Z`, color: INK, width: 1.4 });
    if (r * 5 + c < dots) items.push({ kind: 'dot', cx: xx + cell / 2, cy: yy + cell / 2, r: cell * 0.3, color: DOT });
  }
}

function tenFramePage(o: MathOptions): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const big = o.range === 20;
  const y0 = instruction(items, w, 'How many dots?', big
    ? 'Count the dots in both ten frames. Write how many in the box.'
    : 'Count the dots in each ten frame. Write how many in the box.') + 12;
  const rand = rng(`tf-${o.range}-${o.seed}`);
  const bottom = h - M - 30;
  if (big) {
    // One problem per row: two frames side by side (a double ten frame), then the answer box.
    const nums = pickNumbers(rand, 20, 5, 6);
    const rowH = (bottom - y0) / nums.length;
    const cell = Math.min(34, (rowH - 22) / 2);
    nums.forEach((n, i) => {
      const y = y0 + i * rowH + (rowH - cell * 2) / 2;
      tenFrame(items, M, y, cell, Math.min(10, n));
      tenFrame(items, M + cell * 5 + 18, y, cell, Math.max(0, n - 10));
      items.push({ kind: 'path', d: box(w - M - 64, y + cell - 30, 64, 60), color: INK, width: 1.4 });
    });
  } else {
    // Six problems in two columns.
    const nums = pickNumbers(rand, o.range, 6);
    const rowH = (bottom - y0) / 3;
    const colW = (w - 2 * M) / 2;
    const cell = Math.min(36, (colW - 90) / 5);
    nums.forEach((n, i) => {
      const cx = M + (i % 2) * colW;
      const y = y0 + Math.floor(i / 2) * rowH + (rowH - cell * 2) / 2;
      tenFrame(items, cx, y, cell, n);
      items.push({ kind: 'path', d: box(cx + cell * 5 + 18, y + cell - 28, 56, 56), color: INK, width: 1.4 });
    });
  }
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

/** Lays out `n` shapes in rows of 5 (groups of five are easier to count), centered on cx. */
function shapeGroup(items: Item[], s: Shape, n: number, cx: number, cy: number, gap: number, perRow = 5) {
  const rows = Math.ceil(n / perRow);
  const cols = Math.min(perRow, n);
  // Rows of 10 get a small space after the fifth shape, so kids can count by fives.
  const split = gap * 0.45;
  const span = (cols - 1) * gap + (cols > 5 ? split : 0);
  for (let k = 0; k < n; k++) {
    const c = k % perRow, r = Math.floor(k / perRow);
    const x = cx - span / 2 + c * gap + (c >= 5 ? split : 0);
    const y = cy - ((rows - 1) * gap) / 2 + r * gap;
    shape(items, s, x, y, gap * 0.4);
  }
}

function countCirclePage(o: MathOptions): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const y0 = instruction(items, w, 'Count and circle', 'Count the shapes in each row. Circle the number that tells how many.') + 8;
  const rand = rng(`cc-${o.range}-${o.seed}`);
  const rows = 6;
  const nums = pickNumbers(rand, o.range, rows);
  const rowH = (h - M - 30 - y0) / rows;
  const leftW = (w - 2 * M) * 0.58;
  const perRow = o.range === 20 ? 10 : 5;
  const gap = Math.min(o.range === 20 ? 30 : 40, (rowH - 12) / (o.range === 20 ? 2 : 2));
  nums.forEach((n, i) => {
    const yT = y0 + i * rowH;
    const cy = yT + rowH / 2;
    if (i > 0) items.push({ kind: 'line', x1: M, y1: yT, x2: w - M, y2: yT, color: COLORS.desc, width: 1 });
    shapeGroup(items, SHAPES[i % SHAPES.length], n, M + leftW / 2, cy, gap, perRow);
    // Three choices: the answer and two near it, in random order.
    const near = [n - 2, n - 1, n + 1, n + 2].filter((x) => x >= 1 && x <= o.range && x !== n);
    const wrong = pickNumbers(rand, near.length, 2).map((k) => near[k - 1]);
    const choices = [n, ...wrong].sort(() => rand() - 0.5);
    const zoneX = M + leftW + 10, zoneW = w - M - zoneX;
    const cap = Math.min(34, rowH * 0.36);
    choices.forEach((c, k) => centered(items, String(c), zoneX + zoneW * ((k + 0.5) / 3), cy + cap / 2, cap));
  });
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

function moreLessPage(o: MathOptions): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const word = o.compare === 'more' ? 'more' : 'fewer';
  const y0 = instruction(items, w, `Which group has ${word}?`, `Count each group. Circle the group that has ${word}.`) + 8;
  const rand = rng(`ml-${o.range}-${o.compare}-${o.seed}`);
  const rows = 5;
  const rowH = (h - M - 30 - y0) / rows;
  const half = (w - 2 * M - 24) / 2;
  const cap = Math.min(o.range, 15); // past 15 the groups get too crowded to count on paper
  for (let i = 0; i < rows; i++) {
    const a = 1 + Math.floor(rand() * cap);
    let b = 1 + Math.floor(rand() * cap);
    while (b === a) b = 1 + Math.floor(rand() * cap);
    const yT = y0 + i * rowH + 8;
    const bh = rowH - 16;
    const s = SHAPES[(i + o.seed) % SHAPES.length];
    const gap = Math.min(28, bh / 3.4);
    [a, b].forEach((n, k) => {
      const x = M + k * (half + 24);
      items.push({ kind: 'path', d: box(x, yT, half, bh, 10), color: COLORS.desc, width: 1.4 });
      shapeGroup(items, s, n, x + half / 2, yT + bh / 2, gap, 5);
    });
  }
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

function missingPage(o: MathOptions): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const y0 = instruction(items, w, 'What number is missing?', 'Read each row of numbers out loud. Write the missing number in the empty box.') + 8;
  const rand = rng(`mn-${o.range}-${o.seed}`);
  const rows = 6;
  const rowH = (h - M - 30 - y0) / rows;
  const cols = 5;
  const cellW = (w - 2 * M) / cols;
  const bw = Math.min(70, cellW - 16), bh = Math.min(64, rowH - 22);
  const cap = Math.min(34, bh * 0.55);
  const order = pickNumbers(rand, cols, cols).map((x) => x - 1);
  for (let i = 0; i < rows; i++) {
    const start = 1 + Math.floor(rand() * (o.range - cols + 1));
    // 1 to 5 only has one row of numbers, so move the blank to a different box on each row.
    const blanks = new Set<number>([o.range === 5 ? order[i % cols] : 1 + Math.floor(rand() * (cols - 1))]);
    if (o.range > 5 && rand() < 0.5) blanks.add(blanks.has(cols - 1) ? 0 : cols - 1);
    const yT = y0 + i * rowH + (rowH - bh) / 2;
    for (let c = 0; c < cols; c++) {
      const cx = M + c * cellW + cellW / 2;
      const blank = blanks.has(c);
      items.push({ kind: 'path', d: box(cx - bw / 2, yT, bw, bh, 8), color: blank ? INK : COLORS.desc, width: blank ? 1.6 : 1.2 });
      if (!blank) centered(items, String(start + c), cx, yT + bh / 2 + cap / 2, cap);
    }
  }
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

export function buildMathPage(o: MathOptions): Page {
  if (o.kind === 'count-color') {
    const n = Math.max(1, Math.min(20, Math.round(o.number)));
    const p = countPage({ level: 'pre-k', week: PLANS['pre-k'].weeks[0], name: o.name, paper: o.paper, credit: false, bubble: null }, n, '');
    // countPage draws a blank Name line; add the name and our own footer label.
    const who = styleName(o.name, 'capital');
    if (who) p.items.push({ kind: 'text', x: M + 44, y: 53, size: 14, text: who, color: INK, align: 'left' });
    footer(p.items, p.w, p.h, o.credit, labelFor({ ...o, number: n }));
    return p;
  }
  if (o.kind === 'ten-frame') return tenFramePage(o);
  if (o.kind === 'count-circle') return countCirclePage(o);
  if (o.kind === 'more-less') return moreLessPage(o);
  return missingPage(o);
}

/** Several different pages of the same kind (members print a short set at once). */
export function buildMathSet(o: MathOptions, count: number): Page[] {
  if (o.kind === 'count-color') {
    const out: Page[] = [];
    for (let k = 0; k < count; k++) out.push(buildMathPage({ ...o, number: ((o.number - 1 + k) % 20) + 1 }));
    return out;
  }
  return Array.from({ length: count }, (_, k) => buildMathPage({ ...o, seed: o.seed + k * 7919 }));
}
