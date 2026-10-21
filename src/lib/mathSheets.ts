// Pre-K math worksheets: count and color, ten frames, count and circle, more or fewer, and missing numbers.
// Same page model as the tracing tools and the homeschool packs, so everything is drawn in the browser
// and the child's name (if typed) never leaves the device.
import { PAPER, COLORS, styleName, type Item, type Page, type Paper } from './sheet';
import { M, rng, header, footer, instruction, circlePath, starPath, heartPath, box, centered, countPage, PLANS, type PackOptions } from './homeschool';

export type MathKind = 'count-color' | 'find-number' | 'ten-frame' | 'count-circle' | 'more-less' | 'missing'
  | 'make-ten' | 'tf-add' | 'show-number' | 'blank-frame'
  | 'compare-numbers' | 'compare-symbols' | 'one-more-less'
  | 'add-pictures' | 'add-number-line' | 'add-facts' | 'subtract-pictures'
  | 'subtract-cross' | 'subtract-number-line' | 'subtract-facts'
  | 'mixed-pictures' | 'mixed-number-line' | 'mixed-facts' | 'plus-minus';
export type BlankLayout = 'one' | 'double' | 'six';
export type MathSeries = 'pre-k' | 'ten-frames' | 'more-less' | 'k-addition' | 'k-subtraction' | 'k-mixed';
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
  blank?: BlankLayout; // blank ten frame printable: one big mat, a double ten frame, or six small frames
  series?: MathSeries; // which page the sheet was made on (sets the footer label); default 'pre-k'
  label?: string; // footer label override (pages printed inside a weekly pack carry the week's label)
}

export const MATH_KINDS: { v: MathKind; label: string; sub: string }[] = [
  { v: 'count-color', label: 'Count and color', sub: 'Trace a number, count a ten frame, color that many stars' },
  { v: 'find-number', label: 'Find the number', sub: 'Circle every box of shapes that has your number' },
  { v: 'ten-frame', label: 'Ten frames', sub: 'Count the dots in each frame and write how many' },
  { v: 'count-circle', label: 'Count and circle', sub: 'Count the shapes, circle the right number' },
  { v: 'more-less', label: 'More or fewer', sub: 'Circle the group with more (or fewer)' },
  { v: 'missing', label: 'Missing numbers', sub: 'Fill in the number that comes next' },
];

/** The ten frame worksheets page (/math-worksheets/ten-frames/). */
export const TEN_FRAME_KINDS: { v: MathKind; label: string; sub: string }[] = [
  { v: 'blank-frame', label: 'Blank ten frames', sub: 'Empty frames to use with counters, or to draw in' },
  { v: 'ten-frame', label: 'How many?', sub: 'Count the dots and write how many (1 to 20)' },
  { v: 'show-number', label: 'Show the number', sub: 'Draw dots in the frame to show each number' },
  { v: 'make-ten', label: 'Make 10', sub: 'How many more dots make 10?' },
  { v: 'tf-add', label: 'Ten frame addition', sub: 'Two colors of dots, then write the sum' },
];
/** Kindergarten more or less worksheets (/math-worksheets/more-or-less/). */
export const MORE_LESS_KINDS: { v: MathKind; label: string; sub: string }[] = [
  { v: 'more-less', label: 'Compare groups', sub: 'Count two groups of pictures, circle the one with more (or fewer)' },
  { v: 'compare-numbers', label: 'Compare numbers', sub: 'Circle the bigger (or smaller) number in each pair' },
  { v: 'compare-symbols', label: 'Greater than, less than', sub: 'Write >, < or = between two numbers' },
  { v: 'one-more-less', label: 'One more, one less', sub: 'Write the number before and after' },
];

/** Kindergarten addition worksheets (/math-worksheets/kindergarten-addition/). */
export const ADDITION_KINDS: { v: MathKind; label: string; sub: string }[] = [
  { v: 'add-pictures', label: 'Picture addition', sub: 'Count two groups of pictures, write how many in all' },
  { v: 'add-number-line', label: 'Number line addition', sub: 'Start on the dot, hop forward, write where you land' },
  { v: 'add-facts', label: 'Addition facts', sub: 'Twelve number sentences, no pictures' },
  { v: 'subtract-pictures', label: 'Subtraction with pictures', sub: 'Some pictures are crossed out. How many are left?' },
];

/** Kindergarten subtraction worksheets (/math-worksheets/kindergarten-subtraction/). */
export const SUBTRACTION_KINDS: { v: MathKind; label: string; sub: string }[] = [
  { v: 'subtract-pictures', label: 'Subtraction with pictures', sub: 'Some pictures are crossed out. How many are left?' },
  { v: 'subtract-cross', label: 'Cross out and subtract', sub: 'Your child crosses out the pictures, then counts what is left' },
  { v: 'subtract-number-line', label: 'Number line subtraction', sub: 'Start on the dot, hop back, write where you land' },
  { v: 'subtract-facts', label: 'Subtraction facts', sub: 'Twelve number sentences, no pictures' },
];

/** Mixed addition and subtraction worksheets (/math-worksheets/kindergarten-addition-and-subtraction/). */
export const MIXED_KINDS: { v: MathKind; label: string; sub: string }[] = [
  { v: 'mixed-pictures', label: 'Mixed picture problems', sub: 'Put together or take away: read the sign, then count' },
  { v: 'mixed-number-line', label: 'Mixed number line', sub: 'Hop forward for +, hop back for -' },
  { v: 'mixed-facts', label: 'Mixed facts', sub: 'Twelve + and - number sentences, no pictures' },
  { v: 'plus-minus', label: 'Plus or minus?', sub: 'Write + or - to make each number sentence true' },
];

export const KINDS_FOR: Record<MathSeries, { v: MathKind; label: string; sub: string }[]> = {
  'pre-k': MATH_KINDS,
  'ten-frames': TEN_FRAME_KINDS,
  'more-less': MORE_LESS_KINDS,
  'k-addition': ADDITION_KINDS,
  'k-subtraction': SUBTRACTION_KINDS,
  'k-mixed': MIXED_KINDS,
};

export const BLANK_LAYOUTS: { v: BlankLayout; label: string; sub: string }[] = [
  { v: 'one', label: 'One big frame', sub: 'a counting mat' },
  { v: 'double', label: 'Double frame', sub: 'for 11 to 20' },
  { v: 'six', label: 'Six frames', sub: 'to draw in' },
];

const INK = COLORS.ink;
const DOT2 = '#e8954a'; // second addend in ten frame addition (orange next to the blue)
const DOT = '#5b86d9';
const CROSS = '#d9534f'; // the X on taken-away pictures
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
  if (o.label) return o.label;
  if (o.series === 'ten-frames') {
    const k = TEN_FRAME_KINDS.find((x) => x.v === o.kind)?.label ?? 'Worksheet';
    if (o.kind === 'blank-frame') return `Ten frames: ${BLANK_LAYOUTS.find((x) => x.v === (o.blank ?? 'one'))!.label.toLowerCase()}`;
    if (o.kind === 'make-ten') return `Ten frames: ${k}`;
    if (o.kind === 'tf-add') return `Ten frames: ${k}, ${o.range === 20 ? 'sums 11 to 20' : `within ${o.range}`}`;
    return `Ten frames: ${k}, ${o.range === 20 ? '11 to 20' : rangeText(o.range)}`;
  }
  if (o.series === 'more-less') {
    const k = MORE_LESS_KINDS.find((x) => x.v === o.kind)?.label ?? 'Worksheet';
    return `More or less: ${k}, ${rangeText(o.range)}`;
  }
  if (o.series === 'k-addition') {
    const k = ADDITION_KINDS.find((x) => x.v === o.kind)?.label ?? 'Worksheet';
    return `Kindergarten math: ${k}, within ${o.range}`;
  }
  if (o.series === 'k-subtraction') {
    const k = SUBTRACTION_KINDS.find((x) => x.v === o.kind)?.label ?? 'Worksheet';
    return `Kindergarten math: ${k}, within ${o.range}`;
  }
  if (o.series === 'k-mixed') {
    const k = MIXED_KINDS.find((x) => x.v === o.kind)?.label ?? 'Worksheet';
    return `Kindergarten math: ${k}, within ${o.range}`;
  }
  const k = MATH_KINDS.find((x) => x.v === o.kind)?.label ?? 'Worksheet';
  return o.kind === 'count-color' || o.kind === 'find-number' ? `Pre-K math: ${k}, number ${o.number}` : `Pre-K math: ${k}, ${rangeText(o.range)}`;
};

/** n distinct numbers from 1..max (or fewer if the range is small), in random order. */
function pickNumbers(rand: () => number, max: number, count: number, min = 1): number[] {
  const pool = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const out: number[] = [];
  while (out.length < count) out.push(...pool.slice(0, count - out.length));
  return out;
}

/**
 * A ten frame (2 rows of 5) with the first `dots` boxes filled, top row first.
 * `extra` more boxes after those get a second color (ten frame addition).
 */
function tenFrame(items: Item[], x: number, y: number, cell: number, dots: number, extra = 0, width = 1.4) {
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
    const xx = x + c * cell, yy = y + r * cell, k = r * 5 + c;
    items.push({ kind: 'path', d: `M${f2(xx)} ${f2(yy)} H${f2(xx + cell)} V${f2(yy + cell)} H${f2(xx)} Z`, color: INK, width });
    if (k < dots) items.push({ kind: 'dot', cx: xx + cell / 2, cy: yy + cell / 2, r: cell * 0.3, color: DOT });
    else if (k < dots + extra) items.push({ kind: 'dot', cx: xx + cell / 2, cy: yy + cell / 2, r: cell * 0.3, color: DOT2 });
  }
}

/** Plain text in the page font (for the + and = in number sentences). */
function say(items: Item[], text: string, x: number, y: number, size: number, align: 'left' | 'center' | 'right' = 'left') {
  items.push({ kind: 'text', x, y, size, text, color: INK, align });
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
    const nums = pickNumbers(rand, 20, 5, o.series === 'ten-frames' ? 11 : 6); // the ten frames page keeps 1 to 20 to the teens
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
function shapeGroup(items: Item[], s: Shape, n: number, cx: number, cy: number, gap: number, perRow = 5, fullWidth = false) {
  const rows = Math.ceil(n / perRow);
  const cols = fullWidth ? perRow : Math.min(perRow, n);
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

/** Blank ten frame printables: one big counting mat, a double ten frame, or six small frames to draw in. */
function blankFramePage(o: MathOptions): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const layout = o.blank ?? 'one';
  const note = layout === 'six'
    ? 'Six empty ten frames. Call out a number and draw that many dots, or roll a die and fill a frame.'
    : layout === 'double'
      ? 'Two empty ten frames for numbers 11 to 20. Fill the top frame first, then keep going in the bottom one.'
      : 'An empty ten frame. Put one counter (a button, a coin or a cracker) in each box as you count.';
  const y0 = instruction(items, w, 'Ten frame', note) + 18;
  const bottom = h - M - 34;
  const span = w - 2 * M;
  if (layout === 'six') {
    const colW = span / 2;
    const rowH = (bottom - y0) / 3;
    const cell = Math.min((colW - 30) / 5, (rowH - 30) / 2);
    for (let i = 0; i < 6; i++) {
      const x = M + (i % 2) * colW + (colW - cell * 5) / 2;
      const y = y0 + Math.floor(i / 2) * rowH + (rowH - cell * 2) / 2;
      tenFrame(items, x, y, cell, 0, 0, 1.6);
    }
  } else if (layout === 'double') {
    const gap = 36;
    const cell = Math.min(span / 5, (bottom - y0 - gap) / 4);
    const x = M + (span - cell * 5) / 2;
    const y = y0 + (bottom - y0 - (cell * 4 + gap)) / 2;
    tenFrame(items, x, y, cell, 0, 0, 2.2);
    tenFrame(items, x, y + cell * 2 + gap, cell, 0, 0, 2.2);
  } else {
    // A plain counting mat: the frame alone, centered in the space (no answer box, since nothing is printed to count).
    const cell = Math.min(span / 5, (bottom - y0) / 2.6);
    const x = M + (span - cell * 5) / 2;
    tenFrame(items, x, y0 + Math.max(20, (bottom - y0 - cell * 2) / 2 - 30), cell, 0, 0, 2.4);
  }
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

/** Show the number: a number, then an empty frame (or two) to draw that many dots. */
function showNumberPage(o: MathOptions): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const big = o.range === 20;
  const y0 = instruction(items, w, 'Show the number', big
    ? 'Read the number. Draw that many dots, filling the first ten frame before you start the second.'
    : 'Read the number. Draw that many dots in the ten frame, starting in the top row.') + 12;
  const rand = rng(`sn-${o.range}-${o.seed}`);
  const bottom = h - M - 30;
  if (big) {
    const nums = pickNumbers(rand, 20, 5, 11);
    const rowH = (bottom - y0) / nums.length;
    const cell = Math.min(34, (rowH - 22) / 2);
    const fx = M + 86;
    nums.forEach((n, i) => {
      const y = y0 + i * rowH + (rowH - cell * 2) / 2;
      centered(items, String(n), M + 34, y + cell + 17, 34);
      tenFrame(items, fx, y, cell, 0);
      tenFrame(items, fx + cell * 5 + 18, y, cell, 0);
    });
  } else {
    const nums = pickNumbers(rand, o.range, 6);
    const rowH = (bottom - y0) / 3;
    const colW = (w - 2 * M) / 2;
    const cell = Math.min(36, (colW - 90) / 5);
    nums.forEach((n, i) => {
      const cx = M + (i % 2) * colW;
      const y = y0 + Math.floor(i / 2) * rowH + (rowH - cell * 2) / 2;
      centered(items, String(n), cx + 26, y + cell + 17, 34);
      tenFrame(items, cx + 62, y, cell, 0);
    });
  }
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

/** Make 10: each frame has some dots; draw the rest and write how many more make 10. */
function makeTenPage(o: MathOptions): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const y0 = instruction(items, w, 'Make 10', 'Count the dots. Draw more dots to fill the ten frame, then write how many more make 10.') + 12;
  const rand = rng(`mt-${o.seed}`);
  const nums = pickNumbers(rand, 9, 6);
  const bottom = h - M - 30;
  const rowH = (bottom - y0) / 6;
  const cell = Math.min(34, (rowH - 18) / 2);
  const fw = cell * 5;
  nums.forEach((n, i) => {
    const y = y0 + i * rowH + (rowH - cell * 2) / 2;
    if (i > 0) items.push({ kind: 'line', x1: M, y1: y0 + i * rowH, x2: w - M, y2: y0 + i * rowH, color: COLORS.desc, width: 1 });
    tenFrame(items, M, y, cell, n);
    // Number sentence: n + [ ] = 10
    const ty = y + cell + 9;
    const sx = M + fw + 34;
    say(items, `${n}  +`, sx, ty, 26);
    items.push({ kind: 'path', d: box(sx + 66, y + cell - 26, 58, 52, 8), color: INK, width: 1.5 });
    say(items, '=  10', sx + 140, ty, 26);
  });
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

/** Ten frame addition: blue dots plus orange dots, write the sum. Sums up to 5, 10 or 20. */
function tfAddPage(o: MathOptions): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const big = o.range === 20;
  const y0 = instruction(items, w, 'Ten frame addition', big
    ? 'Count the blue dots and the orange dots. How many in all? Notice how the orange dots fill the first frame to make 10.'
    : 'Count the blue dots and the orange dots. How many in all? Write the answer in the box.') + 12;
  const rand = rng(`ta-${o.range}-${o.seed}`);
  const bottom = h - M - 30;
  const rows = 6;
  const rowH = (bottom - y0) / rows;
  const used = new Set<string>();
  const pairs: [number, number][] = [];
  for (let guard = 0; pairs.length < rows && guard < 400; guard++) {
    let a: number, b: number;
    if (big) { a = 5 + Math.floor(rand() * 5); b = 11 - a + Math.floor(rand() * (Math.min(9, 20 - a) - (11 - a) + 1)); } // a 5..9, sum 11..20
    else { const s = 2 + Math.floor(rand() * (o.range - 1)); a = 1 + Math.floor(rand() * (s - 1)); b = s - a; }
    const k = `${a}+${b}`;
    if (used.has(k) && guard < 300) continue;
    used.add(k);
    pairs.push([a, b]);
  }
  const cell = Math.min(big ? 26 : 32, (rowH - 18) / 2);
  pairs.forEach(([a, b], i) => {
    const y = y0 + i * rowH + (rowH - cell * 2) / 2;
    if (i > 0) items.push({ kind: 'line', x1: M, y1: y0 + i * rowH, x2: w - M, y2: y0 + i * rowH, color: COLORS.desc, width: 1 });
    let fx = M;
    tenFrame(items, fx, y, cell, Math.min(10, a), Math.max(0, Math.min(10, a + b) - a));
    fx += cell * 5;
    if (big) {
      fx += 12;
      tenFrame(items, fx, y, cell, 0, Math.max(0, a + b - 10));
      fx += cell * 5;
    }
    const ty = y + cell + 9;
    const sx = fx + 28;
    say(items, `${a}  +  ${b}  =`, sx, ty, 24);
    const bx = sx + (a >= 10 || b >= 10 ? 118 : 104);
    items.push({ kind: 'path', d: box(bx, y + cell - 26, 62, 52, 8), color: INK, width: 1.5 });
  });
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

// ---------- Kindergarten more or less ----------

/** Distinct random pairs [a, b] from min..max with a !== b. With equalEvery = n, every nth pair is equal (for the = sign). */
function pairs(rand: () => number, count: number, min: number, max: number, equalEvery = 0): [number, number][] {
  const out: [number, number][] = [];
  const used = new Set<string>();
  for (let guard = 0; out.length < count && guard < 500; guard++) {
    const a = min + Math.floor(rand() * (max - min + 1));
    let b = min + Math.floor(rand() * (max - min + 1));
    const wantEqual = equalEvery > 0 && out.length % equalEvery === equalEvery - 1;
    if (wantEqual) b = a;
    else if (a === b) continue;
    const k = `${a}-${b}`;
    if (used.has(k) && guard < 400) continue;
    used.add(k);
    out.push([a, b]);
  }
  return out;
}

/** n small dots in rows of 5, centered under a number, so kids can check by counting. */
function dotRow(items: Item[], n: number, cx: number, y: number, r = 4, gap = 11) {
  const perRow = 5;
  const rows = Math.ceil(n / perRow);
  for (let k = 0; k < n; k++) {
    const c = k % perRow, row = Math.floor(k / perRow);
    const inRow = row === rows - 1 ? n - row * perRow : perRow;
    const x = cx - ((inRow - 1) * gap) / 2 + c * gap;
    items.push({ kind: 'dot', cx: x, cy: y + row * gap, r, color: DOT });
  }
}

/** Compare numbers: two numbers in each pair, circle the bigger (or smaller) one. */
function compareNumbersPage(o: MathOptions): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const word = o.compare === 'more' ? 'bigger' : 'smaller';
  const dots = o.range <= 10;
  const y0 = instruction(items, w, `Circle the ${word} number`, dots
    ? `Read both numbers. Count the dots if it helps. Circle the number that is ${word}.`
    : `Read both numbers out loud. Circle the number that is ${word}.`) + 10;
  const rand = rng(`cn-${o.range}-${o.compare}-${o.seed}`);
  const list = pairs(rand, 10, 1, o.range);
  const rows = 5;
  const bottom = h - M - 30;
  const rowH = (bottom - y0) / rows;
  const colW = (w - 2 * M) / 2;
  const bw = Math.min(84, colW / 2 - 26), bh = Math.min(dots ? 84 : 64, rowH - 18);
  const cap = Math.min(30, bh * 0.4);
  list.forEach(([a, b], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const cx = M + col * colW + colW / 2;
    const yT = y0 + row * rowH + (rowH - bh) / 2;
    if (row > 0 && col === 0) items.push({ kind: 'line', x1: M, y1: y0 + row * rowH, x2: w - M, y2: y0 + row * rowH, color: COLORS.desc, width: 1 });
    [a, b].forEach((n, k) => {
      const bx = cx + (k === 0 ? -bw - 12 : 12);
      items.push({ kind: 'path', d: box(bx, yT, bw, bh, 10), color: COLORS.desc, width: 1.4 });
      const base = dots ? yT + 10 + cap : yT + bh / 2 + cap / 2;
      centered(items, String(n), bx + bw / 2, base, cap);
      if (dots) dotRow(items, n, bx + bw / 2, base + 14, 3.6, Math.min(12, (bw - 14) / 5));
    });
  });
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

/** Greater than, less than: write >, < or = in the circle between two numbers. */
function compareSymbolsPage(o: MathOptions): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const dots = o.range <= 10;
  let y0 = instruction(items, w, 'Greater than, less than', 'Compare the two numbers. Write > (greater than), < (less than) or = (equal to) in the circle. The open side faces the bigger number.');
  // A small key so the grown-up and child can check the symbols.
  const ky = y0 + 20;
  const kw = (w - 2 * M) / 3;
  ([['5 > 3', '5 is greater than 3'], ['2 < 4', '2 is less than 4'], ['3 = 3', '3 is equal to 3']] as const).forEach(([sym, words], k) => {
    say(items, sym, M + k * kw, ky, 18);
    say(items, words, M + k * kw + 54, ky - 1, 10);
  });
  items.push({ kind: 'line', x1: M, y1: ky + 14, x2: w - M, y2: ky + 14, color: COLORS.desc, width: 1 });
  y0 = ky + 22;
  const rand = rng(`cs-${o.range}-${o.seed}`);
  const list = pairs(rand, 10, 1, o.range, 5);
  const rows = 5;
  const bottom = h - M - 30;
  const rowH = (bottom - y0) / rows;
  const colW = (w - 2 * M) / 2;
  const cap = Math.min(32, rowH * 0.34);
  list.forEach(([a, b], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const cx = M + col * colW + colW / 2;
    const cy = y0 + row * rowH + rowH * (dots ? 0.38 : 0.5);
    if (row > 0 && col === 0) items.push({ kind: 'line', x1: M, y1: y0 + row * rowH, x2: w - M, y2: y0 + row * rowH, color: COLORS.desc, width: 1 });
    const off = Math.min(72, colW / 2 - 34);
    centered(items, String(a), cx - off, cy + cap / 2, cap);
    centered(items, String(b), cx + off, cy + cap / 2, cap);
    items.push({ kind: 'path', d: circlePath(cx, cy, 24), color: INK, width: 1.5 });
    if (dots) {
      dotRow(items, a, cx - off, cy + cap / 2 + 16, 3.4, 10);
      dotRow(items, b, cx + off, cy + cap / 2 + 16, 3.4, 10);
    }
  });
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

/** One more, one less: write the number that comes before and after. */
function oneMoreLessPage(o: MathOptions): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  let y0 = instruction(items, w, 'One less, one more', 'Read the number in the middle. Write the number that is one less on the left and one more on the right. A number line or counters can help.');
  const span = w - 2 * M;
  const xs = [M + span * 0.2, M + span * 0.5, M + span * 0.8];
  ['1 less', 'the number', '1 more'].forEach((t, k) => say(items, t, xs[k], y0 + 18, 13, 'center'));
  y0 += 28;
  const rand = rng(`om-${o.range}-${o.seed}`);
  const rows = 7;
  // 1 to 5 only has 3 middle numbers that work (2, 3, 4), so they repeat; otherwise the middle number is 2 to range - 1.
  const nums = pickNumbers(rand, o.range - 1, rows, 2);
  const bottom = h - M - 30;
  const rowH = (bottom - y0) / rows;
  const bw = 76, bh = Math.min(62, rowH - 14);
  const cap = Math.min(32, bh * 0.55);
  nums.forEach((n, i) => {
    const yT = y0 + i * rowH + (rowH - bh) / 2;
    xs.forEach((x, k) => {
      const mid = k === 1;
      items.push({ kind: 'path', d: box(x - bw / 2, yT, bw, bh, 8), color: mid ? COLORS.desc : INK, width: mid ? 1.2 : 1.6 });
      if (mid) centered(items, String(n), x, yT + bh / 2 + cap / 2, cap);
    });
  });
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

// ---------- Kindergarten addition and subtraction ----------

/** Addition problems [a, b]: within 5 and 10 the sum is 2 to the range; within 20 the sums run 8 to 20 with each part 10 or less. */
function addPairs(rand: () => number, count: number, range: MathRange): [number, number][] {
  const out: [number, number][] = [];
  const used = new Set<string>();
  for (let guard = 0; out.length < count && guard < 600; guard++) {
    let a: number, b: number;
    if (range === 20) { a = 1 + Math.floor(rand() * 10); const lo = Math.max(1, 8 - a); b = lo + Math.floor(rand() * (10 - lo + 1)); }
    else { const s = 2 + Math.floor(rand() * (range - 1)); a = 1 + Math.floor(rand() * (s - 1)); b = s - a; }
    const k = `${a}+${b}`;
    if (used.has(k) && guard < 500) continue;
    used.add(k);
    out.push([a, b]);
  }
  return out;
}

/**
 * Subtraction problems [a, b] with a - b: within 5 and 10, a runs 2 to the range; within 20, a runs 8 to 20
 * and b stays at 10 or less, so the answer is never below 0 and kids take away a group they can count.
 * Only within 5 can b equal a (an answer of 0).
 */
function subPairs(rand: () => number, count: number, range: MathRange): [number, number][] {
  const out: [number, number][] = [];
  const used = new Set<string>();
  for (let guard = 0; out.length < count && guard < 600; guard++) {
    const lo = range === 20 ? 8 : 2;
    const a = lo + Math.floor(rand() * (range - lo + 1));
    // Within 5 a few answers can be 0 (5 - 5), which kindergarten covers and which keeps 12 facts from repeating.
    const b = 1 + Math.floor(rand() * (range === 5 ? a : Math.min(10, a - 1)));
    const k = `${a}-${b}`;
    if (used.has(k) && guard < 500) continue;
    used.add(k);
    out.push([a, b]);
  }
  return out;
}

/** Plus and equals signs drawn as lines (bigger and clearer than text at this size). */
function plus(items: Item[], cx: number, cy: number, s = 11) {
  items.push({ kind: 'line', x1: cx - s, y1: cy, x2: cx + s, y2: cy, color: INK, width: 3 });
  items.push({ kind: 'line', x1: cx, y1: cy - s, x2: cx, y2: cy + s, color: INK, width: 3 });
}
function equals(items: Item[], cx: number, cy: number, s = 11) {
  items.push({ kind: 'line', x1: cx - s, y1: cy - 5, x2: cx + s, y2: cy - 5, color: INK, width: 3 });
  items.push({ kind: 'line', x1: cx - s, y1: cy + 5, x2: cx + s, y2: cy + 5, color: INK, width: 3 });
}

/** Picture addition: a group of pictures plus another group, write how many in all. */
function addPicturesPage(o: MathOptions): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const y0 = instruction(items, w, `Picture addition within ${o.range}`, 'Count the pictures in each group. Then count them all and write how many in the box.') + 8;
  const rand = rng(`ap-${o.range}-${o.seed}`);
  const rows = 6;
  const list = addPairs(rand, rows, o.range);
  const bottom = h - M - 30;
  const rowH = (bottom - y0) / rows;
  const span = w - 2 * M;
  const gw = span * 0.33, sign = span * 0.075, bw = 62;
  list.forEach(([a, b], i) => {
    const yT = y0 + i * rowH + 4;
    const gh = rowH - 26;
    const cy = yT + gh / 2;
    const s = SHAPES[(i + o.seed) % SHAPES.length];
    const most = Math.max(a, b);
    const gap = Math.min(30, gh / (most > 5 ? 2.2 : 1.3), (gw - 12) / 5.2);
    let x = M;
    [a, b].forEach((n, k) => {
      items.push({ kind: 'path', d: box(x, yT, gw, gh, 10), color: COLORS.desc, width: 1.4 });
      shapeGroup(items, s, n, x + gw / 2, cy, gap, 5);
      x += gw;
      if (k === 0) { plus(items, x + sign / 2, cy); x += sign; }
    });
    equals(items, x + sign / 2, cy);
    x += sign;
    items.push({ kind: 'path', d: box(x + (w - M - x - bw) / 2, cy - 28, bw, 56, 8), color: INK, width: 1.6 });
  });
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

/** Number line addition (or subtraction): start on the dot, hop forward (or back), write where you land. */
function numberLinePage(o: MathOptions, sub = false): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const y0 = instruction(items, w, `Number line ${sub ? 'subtraction' : 'addition'} within ${o.range}`, sub
    ? 'Put a finger on the first number (the blue dot). Hop back the second number, one jump at a time. Write the number you land on.'
    : 'Put a finger on the first number (the blue dot). Hop forward the second number, one jump at a time. Write the number you land on.') + 6;
  const rand = rng(`${sub ? 'snl' : 'nl'}-${o.range}-${o.seed}`);
  const rows = 5;
  const list = sub ? subPairs(rand, rows, o.range) : addPairs(rand, rows, o.range);
  const op = sub ? '-' : '+';
  const wide = list.some(([a, b]) => a >= 10 || b >= 10);
  const bottom = h - M - 30;
  const rowH = (bottom - y0) / rows;
  const max = o.range;
  const x0 = M + 10, x1 = w - M - 10;
  const step = (x1 - x0) / max;
  const label = o.range === 20 ? 11 : 14;
  list.forEach(([a, b], i) => {
    const yT = y0 + i * rowH;
    if (i > 0) items.push({ kind: 'line', x1: M, y1: yT, x2: w - M, y2: yT, color: COLORS.desc, width: 1 });
    const ty = yT + 36;
    say(items, `${a}  ${op}  ${b}  =`, M, ty, 24);
    items.push({ kind: 'path', d: box(M + (wide ? 118 : 104), ty - 32, 58, 44, 8), color: INK, width: 1.5 });
    // The line sits low in the row, leaving room above it to draw the hops.
    const ly = yT + rowH - 40;
    items.push({ kind: 'line', x1: x0 - 6, y1: ly, x2: x1 + 6, y2: ly, color: INK, width: 1.6 });
    for (let n = 0; n <= max; n++) {
      const x = x0 + n * step;
      const tall = n % 5 === 0;
      items.push({ kind: 'line', x1: x, y1: ly - (tall ? 8 : 5), x2: x, y2: ly + (tall ? 8 : 5), color: INK, width: tall ? 1.6 : 1.1 });
      say(items, String(n), x, ly + 23, label, 'center');
    }
    items.push({ kind: 'dot', cx: x0 + a * step, cy: ly, r: 5.5, color: DOT });
  });
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

/** Addition (or subtraction) facts: twelve number sentences in two columns. */
function factsPage(o: MathOptions, sub = false): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const y0 = instruction(items, w, `${sub ? 'Subtraction' : 'Addition'} facts within ${o.range}`, 'Solve each one. Fingers, counters or a number line are all fine to use.') + 8;
  const rand = rng(`${sub ? 'sf' : 'af'}-${o.range}-${o.seed}`);
  const list = sub ? subPairs(rand, 12, o.range) : addPairs(rand, 12, o.range);
  const op = sub ? '-' : '+';
  const wide = list.some(([a, b]) => a >= 10 || b >= 10);
  const rows = 6;
  const bottom = h - M - 30;
  const rowH = (bottom - y0) / rows;
  const colW = (w - 2 * M) / 2;
  list.forEach(([a, b], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * colW + 14;
    const cy = y0 + row * rowH + rowH / 2;
    if (row > 0 && col === 0) items.push({ kind: 'line', x1: M, y1: y0 + row * rowH, x2: w - M, y2: y0 + row * rowH, color: COLORS.desc, width: 1 });
    say(items, `${a}  ${op}  ${b}  =`, x, cy + 10, 28);
    const bx = x + (wide ? 138 : 122);
    items.push({ kind: 'path', d: box(bx, cy - 27, 62, 54, 8), color: INK, width: 1.5 });
  });
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

/**
 * Subtraction with pictures: some pictures are crossed out; write how many are left.
 * With `self`, nothing is crossed out yet: the child reads the number sentence, draws an X on that many pictures, then counts what is left.
 */
function subtractPicturesPage(o: MathOptions, self = false): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const y0 = self
    ? instruction(items, w, `Cross out and subtract within ${o.range}`, 'Read the number sentence. Draw an X on that many pictures, starting from the end. Count the pictures that are left and write the number.') + 8
    : instruction(items, w, `Subtraction within ${o.range}`, 'Count all the pictures. The ones with an X are taken away. Count the pictures that are left and write the number.') + 8;
  const rand = rng(`${self ? 'sx' : 'sp'}-${o.range}-${o.seed}`);
  const rows = 6;
  const list = subPairs(rand, rows, o.range);
  const wide = list.some(([a, b]) => a >= 10 || b >= 10); // one column of answer boxes per page
  const bottom = h - M - 30;
  const rowH = (bottom - y0) / rows;
  const span = w - 2 * M;
  const gw = span * 0.55;
  const perRow = o.range === 20 ? 10 : 5;
  list.forEach(([a, b], i) => {
    const yT = y0 + i * rowH + 5;
    const gh = rowH - 10;
    const cy = yT + gh / 2;
    const s = SHAPES[(i + o.seed) % SHAPES.length];
    const gap = Math.min(30, gh / (a > perRow ? 2.2 : 1.3), (gw - 20) / (perRow + 0.9));
    items.push({ kind: 'path', d: box(M, yT, gw, gh, 10), color: COLORS.desc, width: 1.4 });
    // Same placement as shapeGroup, so the X marks land on the last b pictures.
    const rowsN = Math.ceil(a / perRow);
    const cols = Math.min(perRow, a);
    const split = gap * 0.45;
    const spanG = (cols - 1) * gap + (cols > 5 ? split : 0);
    const cx = M + gw / 2;
    for (let k = 0; k < a; k++) {
      const c = k % perRow, r = Math.floor(k / perRow);
      const x = cx - spanG / 2 + c * gap + (c >= 5 ? split : 0);
      const y = cy - ((rowsN - 1) * gap) / 2 + r * gap;
      shape(items, s, x, y, gap * 0.4);
      if (!self && k >= a - b) {
        const d = gap * 0.33;
        items.push({ kind: 'line', x1: x - d, y1: y - d, x2: x + d, y2: y + d, color: CROSS, width: 2.2 });
        items.push({ kind: 'line', x1: x - d, y1: y + d, x2: x + d, y2: y - d, color: CROSS, width: 2.2 });
      }
    }
    const sx = M + gw + 22;
    say(items, `${a}  -  ${b}  =`, sx, cy + 9, 24);
    items.push({ kind: 'path', d: box(sx + (wide ? 118 : 104), cy - 26, 58, 52, 8), color: INK, width: 1.5 });
  });
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

// ---------- Kindergarten mixed addition and subtraction ----------

type Problem = { a: number; b: number; op: '+' | '-' };

/**
 * A mix of addition and subtraction problems: half of each (the odd one out is random), shuffled so the sign
 * never stays the same more than twice in a row. Kids have to read the sign on every problem.
 */
function mixedProblems(rand: () => number, count: number, range: MathRange): Problem[] {
  const nAdd = Math.floor(count / 2) + (count % 2 && rand() < 0.5 ? 1 : 0);
  const adds = addPairs(rand, nAdd, range).map(([a, b]) => ({ a, b, op: '+' as const }));
  const subs = subPairs(rand, count - nAdd, range).map(([a, b]) => ({ a, b, op: '-' as const }));
  const all: Problem[] = [...adds, ...subs];
  for (let guard = 0; guard < 200; guard++) {
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    const runs = all.some((p, i) => i >= 2 && p.op === all[i - 1].op && p.op === all[i - 2].op);
    if (!runs && all[0].op === '+') break; // start with adding, the easier of the two
  }
  return all;
}
const answer = (p: Problem) => (p.op === '+' ? p.a + p.b : p.a - p.b);

/** Mixed picture problems: adding rows show two groups, taking away rows show crossed-out pictures. */
function mixedPicturesPage(o: MathOptions): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const y0 = instruction(items, w, `Add or subtract within ${o.range}`, 'Look at the sign first. A plus sign (+) means put the two groups together and count them all. A minus sign (-) means the pictures with an X are taken away, so count the ones that are left. Write the answer in the box.') + 8;
  const rand = rng(`mp-${o.range}-${o.seed}`);
  const rows = 6;
  const list = mixedProblems(rand, rows, o.range);
  const wide = list.some((p) => p.a >= 10 || p.b >= 10);
  const bottom = h - M - 30;
  const rowH = (bottom - y0) / rows;
  const span = w - 2 * M;
  const gw = span * 0.58;
  list.forEach((p, i) => {
    const yT = y0 + i * rowH + 5;
    const gh = rowH - 10;
    const cy = yT + gh / 2;
    const s = SHAPES[(i + o.seed) % SHAPES.length];
    if (p.op === '+') {
      // Two boxes with a plus between them, filling the same width as one take-away box.
      const sign = 26;
      const bw = (gw - sign) / 2;
      const gap = Math.min(28, gh / (Math.max(p.a, p.b) > 5 ? 2.2 : 1.3), (bw - 10) / 5.2);
      items.push({ kind: 'path', d: box(M, yT, bw, gh, 10), color: COLORS.desc, width: 1.4 });
      shapeGroup(items, s, p.a, M + bw / 2, cy, gap, 5);
      plus(items, M + bw + sign / 2, cy, 8);
      items.push({ kind: 'path', d: box(M + bw + sign, yT, bw, gh, 10), color: COLORS.desc, width: 1.4 });
      shapeGroup(items, s, p.b, M + bw + sign + bw / 2, cy, gap, 5);
    } else {
      const perRow = o.range === 20 ? 10 : 5;
      const gap = Math.min(28, gh / (p.a > perRow ? 2.2 : 1.3), (gw - 20) / (perRow + 0.9));
      items.push({ kind: 'path', d: box(M, yT, gw, gh, 10), color: COLORS.desc, width: 1.4 });
      const rowsN = Math.ceil(p.a / perRow);
      const cols = Math.min(perRow, p.a);
      const split = gap * 0.45;
      const spanG = (cols - 1) * gap + (cols > 5 ? split : 0);
      const cx = M + gw / 2;
      for (let k = 0; k < p.a; k++) {
        const c = k % perRow, r = Math.floor(k / perRow);
        const x = cx - spanG / 2 + c * gap + (c >= 5 ? split : 0);
        const y = cy - ((rowsN - 1) * gap) / 2 + r * gap;
        shape(items, s, x, y, gap * 0.4);
        if (k >= p.a - p.b) {
          const d = gap * 0.33;
          items.push({ kind: 'line', x1: x - d, y1: y - d, x2: x + d, y2: y + d, color: CROSS, width: 2.2 });
          items.push({ kind: 'line', x1: x - d, y1: y + d, x2: x + d, y2: y - d, color: CROSS, width: 2.2 });
        }
      }
    }
    const sx = M + gw + 18;
    say(items, `${p.a}  ${p.op}  ${p.b}  =`, sx, cy + 9, 24);
    items.push({ kind: 'path', d: box(sx + (wide ? 118 : 104), cy - 26, 58, 52, 8), color: INK, width: 1.5 });
  });
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

/** Mixed number line: hop forward for +, back for -. */
function mixedNumberLinePage(o: MathOptions): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const y0 = instruction(items, w, `Number line, add or subtract within ${o.range}`, 'Put a finger on the first number (the blue dot). Read the sign. For a plus sign (+) hop forward, and for a minus sign (-) hop back, one jump at a time. Write the number you land on.') + 6;
  const rand = rng(`mnl-${o.range}-${o.seed}`);
  const rows = 5;
  const list = mixedProblems(rand, rows, o.range);
  const wide = list.some((p) => p.a >= 10 || p.b >= 10);
  const bottom = h - M - 30;
  const rowH = (bottom - y0) / rows;
  const max = o.range;
  const x0 = M + 10, x1 = w - M - 10;
  const step = (x1 - x0) / max;
  const label = o.range === 20 ? 11 : 14;
  list.forEach((p, i) => {
    const yT = y0 + i * rowH;
    if (i > 0) items.push({ kind: 'line', x1: M, y1: yT, x2: w - M, y2: yT, color: COLORS.desc, width: 1 });
    const ty = yT + 36;
    say(items, `${p.a}  ${p.op}  ${p.b}  =`, M, ty, 24);
    items.push({ kind: 'path', d: box(M + (wide ? 118 : 104), ty - 32, 58, 44, 8), color: INK, width: 1.5 });
    const ly = yT + rowH - 40;
    items.push({ kind: 'line', x1: x0 - 6, y1: ly, x2: x1 + 6, y2: ly, color: INK, width: 1.6 });
    for (let n = 0; n <= max; n++) {
      const x = x0 + n * step;
      const tall = n % 5 === 0;
      items.push({ kind: 'line', x1: x, y1: ly - (tall ? 8 : 5), x2: x, y2: ly + (tall ? 8 : 5), color: INK, width: tall ? 1.6 : 1.1 });
      say(items, String(n), x, ly + 23, label, 'center');
    }
    items.push({ kind: 'dot', cx: x0 + p.a * step, cy: ly, r: 5.5, color: DOT });
  });
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

/** Mixed facts: twelve number sentences, six adding and six taking away, in two columns. */
function mixedFactsPage(o: MathOptions): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const y0 = instruction(items, w, `Addition and subtraction facts within ${o.range}`, 'Read the sign before you solve each one. A plus sign (+) means add and a minus sign (-) means take away. Fingers, counters or a number line are all fine to use.') + 8;
  const rand = rng(`mf-${o.range}-${o.seed}`);
  const list = mixedProblems(rand, 12, o.range);
  const wide = list.some((p) => p.a >= 10 || p.b >= 10);
  const rows = 6;
  const bottom = h - M - 30;
  const rowH = (bottom - y0) / rows;
  const colW = (w - 2 * M) / 2;
  list.forEach((p, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * colW + 14;
    const cy = y0 + row * rowH + rowH / 2;
    if (row > 0 && col === 0) items.push({ kind: 'line', x1: M, y1: y0 + row * rowH, x2: w - M, y2: y0 + row * rowH, color: COLORS.desc, width: 1 });
    say(items, `${p.a}  ${p.op}  ${p.b}  =`, x, cy + 10, 28);
    items.push({ kind: 'path', d: box(x + (wide ? 138 : 122), cy - 27, 62, 54, 8), color: INK, width: 1.5 });
  });
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

/** Plus or minus?: the answer is given; write + or - in the circle so the number sentence is true. */
function plusMinusPage(o: MathOptions): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const y0 = instruction(items, w, 'Plus or minus?', 'Read each number sentence. Did the first number get bigger or smaller? Write a plus sign (+) in the circle if it got bigger and a minus sign (-) if it got smaller.') + 8;
  const rand = rng(`pm-${o.range}-${o.seed}`);
  const list = mixedProblems(rand, 10, o.range);
  const rows = 5;
  const bottom = h - M - 30;
  const rowH = (bottom - y0) / rows;
  const colW = (w - 2 * M) / 2;
  const size = 26;
  const digit = size * 0.62; // a little more than one digit is wide in the page font, so two-digit numbers never touch the = sign
  list.forEach((p, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * colW + 12;
    const cy = y0 + row * rowH + rowH / 2;
    if (row > 0 && col === 0) items.push({ kind: 'line', x1: M, y1: y0 + row * rowH, x2: w - M, y2: y0 + row * rowH, color: COLORS.desc, width: 1 });
    // Fixed columns so every circle, = sign and answer lines up down the page: [a] (circle) [b] = [answer]
    const aw = 2 * digit;
    say(items, String(p.a), x + aw, cy + size * 0.35, size, 'right');
    const ccx = x + aw + 30;
    items.push({ kind: 'path', d: circlePath(ccx, cy, 20), color: INK, width: 1.5 });
    say(items, String(p.b), ccx + 30, cy + size * 0.35, size);
    say(items, '=', ccx + 30 + aw + 22, cy + size * 0.35, size);
    say(items, String(answer(p)), ccx + 30 + aw + 52, cy + size * 0.35, size);
  });
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

/**
 * Find the number: a key at the top shows the number and that many dots in a ten frame, then six boxes of shapes.
 * Two or three boxes hold exactly that many; the rest hold one or two more or fewer. Kids circle every match,
 * then write how many boxes they circled. Built for the number of the week in the Pre-K plan (1 to 20).
 */
function findNumberPage(o: MathOptions): Page {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  top(items, w, o.name);
  const n = Math.max(1, Math.min(20, Math.round(o.number)));
  const y0 = instruction(items, w, `Find ${n}`, `Count the shapes in each box. Circle every box that has ${n}. Then write how many boxes you circled.`) + 8;
  const rand = rng(`fn-${n}-${o.seed}`);

  // The key: the numeral, then n dots in one or two ten frames.
  const frames = n > 10 ? 2 : 1;
  const cell = 22;
  const keyH = cell * 2 + 20;
  items.push({ kind: 'path', d: box(M, y0, w - 2 * M, keyH, 10), color: COLORS.desc, width: 1.2 });
  const kc = y0 + keyH / 2;
  centered(items, String(n), M + 46, kc + 17, 34);
  say(items, 'looks like', M + 92, kc + 5, 13);
  const fx = M + 172;
  tenFrame(items, fx, kc - cell, cell, Math.min(10, n));
  if (frames === 2) tenFrame(items, fx + cell * 5 + 14, kc - cell, cell, n - 10);

  // Six boxes: 2 or 3 matches, the rest near misses (never below 1 or above 20).
  const matches = n === 1 ? 3 : 2 + Math.floor(rand() * 2);
  const near = [n - 2, n - 1, n + 1, n + 2].filter((x) => x >= 1 && x <= 20);
  const counts: number[] = [];
  for (let i = 0; i < 6; i++) counts.push(i < matches ? n : near[Math.floor(rand() * near.length)]);
  for (let i = counts.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [counts[i], counts[j]] = [counts[j], counts[i]]; }

  const answerH = 64;
  const gy = y0 + keyH + 16;
  const bottom = h - M - 30 - answerH;
  const gapX = 18, gapY = 14;
  const bw = (w - 2 * M - gapX) / 2;
  const bh = (bottom - gy - 2 * gapY) / 3;
  // Shapes sit in rows of 5. Past 10, the first ten get a little space below them (like a full ten frame), so kids can say "ten" and count on.
  const maxRows = Math.ceil(Math.max(...counts) / 5);
  const big = Math.max(...counts) > 10;
  const gap = Math.min(30, (bh - 18) / (Math.max(2, maxRows) + (big ? 0.35 : 0)), (bw - 24) / 5);
  counts.forEach((c, i) => {
    const x = M + (i % 2) * (bw + gapX);
    const y = gy + Math.floor(i / 2) * (bh + gapY);
    items.push({ kind: 'path', d: box(x, y, bw, bh, 10), color: INK, width: 1.3 });
    const s = SHAPES[(i + o.seed) % SHAPES.length];
    if (c <= 10) { shapeGroup(items, s, c, x + bw / 2, y + bh / 2, gap, 5); return; }
    const rest = Math.ceil((c - 10) / 5);
    const split = gap * 0.35;
    const y1 = y + bh / 2 - ((1 + rest) * gap + split) / 2; // center of the first row
    shapeGroup(items, s, 10, x + bw / 2, y1 + gap / 2, gap, 5);
    shapeGroup(items, s, c - 10, x + bw / 2, y1 + 2 * gap + split + ((rest - 1) * gap) / 2, gap, 5, true);
  });

  const ay = bottom + 18;
  say(items, `How many boxes have ${n}?`, M, ay + 26, 14);
  items.push({ kind: 'path', d: box(M + 214, ay, 60, 44, 8), color: INK, width: 1.4 });
  footer(items, w, h, o.credit, labelFor({ ...o, number: n }));
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
  if (o.kind === 'find-number') return findNumberPage(o);
  if (o.kind === 'ten-frame') return tenFramePage(o);
  if (o.kind === 'blank-frame') return blankFramePage(o);
  if (o.kind === 'show-number') return showNumberPage(o);
  if (o.kind === 'make-ten') return makeTenPage(o);
  if (o.kind === 'tf-add') return tfAddPage(o);
  if (o.kind === 'count-circle') return countCirclePage(o);
  if (o.kind === 'more-less') return moreLessPage(o);
  if (o.kind === 'compare-numbers') return compareNumbersPage(o);
  if (o.kind === 'compare-symbols') return compareSymbolsPage(o);
  if (o.kind === 'one-more-less') return oneMoreLessPage(o);
  if (o.kind === 'add-pictures') return addPicturesPage(o);
  if (o.kind === 'add-number-line') return numberLinePage(o);
  if (o.kind === 'add-facts') return factsPage(o);
  if (o.kind === 'subtract-pictures') return subtractPicturesPage(o);
  if (o.kind === 'subtract-cross') return subtractPicturesPage(o, true);
  if (o.kind === 'subtract-number-line') return numberLinePage(o, true);
  if (o.kind === 'subtract-facts') return factsPage(o, true);
  if (o.kind === 'mixed-pictures') return mixedPicturesPage(o);
  if (o.kind === 'mixed-number-line') return mixedNumberLinePage(o);
  if (o.kind === 'mixed-facts') return mixedFactsPage(o);
  if (o.kind === 'plus-minus') return plusMinusPage(o);
  return missingPage(o);
}

/** Several different pages of the same kind (members print a short set at once). */
export function buildMathSet(o: MathOptions, count: number): Page[] {
  if (o.kind === 'count-color' || o.kind === 'find-number') {
    const out: Page[] = [];
    for (let k = 0; k < count; k++) out.push(buildMathPage({ ...o, number: ((o.number - 1 + k) % 20) + 1 }));
    return out;
  }
  return Array.from({ length: count }, (_, k) => buildMathPage({ ...o, seed: o.seed + k * 7919 }));
}

/** The extra math page in a Pre-K weekly pack: find the number of the week. Each week gets its own layout. */
export function packFindNumberPage(o: PackOptions, n: number, label: string): Page {
  return buildMathPage({ kind: 'find-number', range: 20, number: n, compare: 'more', name: o.name, paper: o.paper, credit: o.credit, seed: o.week.n, series: 'pre-k', label });
}
