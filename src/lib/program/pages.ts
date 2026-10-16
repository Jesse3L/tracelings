// Themed printable pages for the personalized program, and the whole week's pack.
// Built on the same page model as the free plans (sheet.ts, homeschool.ts), drawn in the browser.
// The child's name is swapped in for {{name}} only here, at print time, and never leaves the device.
import { PAPER, COLORS, styleName, layoutWord, type Item, type Page, type Paper } from '../sheet';
import { drawCell, drawText, wrapToWidth, cleanTraceText } from '../rowSheet';
import { buildColoringPage } from '../coloring';
import type { LoadedFont } from '../fontshape';
import { SITE } from '../../config';
import { PLANS, M, rng, header, footer, para, circlePath, starPath, box, centered, weekDays, versePage, verseFor, FAMILIES, type PackOptions, type Week } from '../homeschool';
import type { ChildProfile, ProgramWeek, ThemeId, WeekContent } from './types';
import { THEMES, smallIcons, iconPath, storyIcon, mentionsIcon, countedIcon, type ThemeIcon } from './themes';
import { baseWeekOf, weekTitle, reviewLetters, type MathStep } from './engine';

const INK = COLORS.ink;
const f2 = (n: number) => Math.round(n * 100) / 100;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// ---------- Text helpers ----------

/** Swaps {{name}} for the child's name (or "your child" style fallbacks when none is typed). */
export function personalize(text: string, name: string): string {
  const who = styleName(name, 'capital') || 'Little One';
  return text.replace(/\{\{name\}\}'s/g, `${who}'s`).replace(/\{\{name\}\}/g, who);
}
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
const plural = (n: number, ic: ThemeIcon) => (n === 1 ? ic.one : ic.many);

// ---------- Icons ----------

/** Maps an icon's 0..1000 path into a size x size box centered at (cx, cy). flip turns it upside down. */
function placePath(d: string, cx: number, cy: number, size: number, flip = false): string {
  const s = size / 1000;
  const ox = cx - size / 2, oy = cy - size / 2;
  let i = 0;
  return d.replace(/-?\d+(?:\.\d+)?/g, (m) => {
    const v = Number(m) * s;
    const isX = i++ % 2 === 0;
    return f2(flip ? (isX ? cx + size / 2 - v : cy + size / 2 - v) : (isX ? ox + v : oy + v)).toString();
  });
}

/** Draws a theme icon (or a plain star until the theme's pictures load). */
export function drawIcon(items: Item[], theme: ThemeId, id: string, cx: number, cy: number, size: number, flip = false) {
  const d = iconPath(theme, id);
  if (d) items.push({ kind: 'path', d: placePath(d, cx, cy, size, flip), color: INK, width: 0, fill: INK, evenOdd: true });
  else items.push({ kind: 'path', d: starPath(cx, cy, size * 0.42), color: INK, width: 1.4, fill: '#ffffff' });
}

const iconById = (theme: ThemeId, id?: string | null) => THEMES[theme].icons.find((i) => i.id === id);
/** The icon a word problem counts: the pictured thing named right after one of its numbers ("4 eggs"; see
 *  countedIcon). With no noun after the numbers: the given icon when the text names it, else the first pictured thing
 *  the text names. Null when what is counted has no picture ("4 steps"): the page counts plain circles instead of
 *  showing a picture that has nothing to do with the problem. */
export function problemIcon(theme: ThemeId, text: string, id?: string, nums: number[] = []): ThemeIcon | null {
  const counted = nums.length ? countedIcon(theme, text, nums) : undefined;
  if (counted === null) return null;                      // what the child counts has no picture: plain circles
  if (counted) return iconById(theme, counted) ?? null;   // what the child counts, even if another icon was given
  const given = iconById(theme, id);
  if (given && mentionsIcon(theme, text, given.id)) return given;
  return iconById(theme, storyIcon(theme, text)) ?? null;
}

/** The picture for each story page: the story's own choice when that page names it, else the matcher's.
 *  Null means nothing on the page has a picture (the page gets a "Draw it!" box). Matching runs on the
 *  text with {{name}} still in it, so a child called Rex never gets a T-rex. */
export function storyPictures(theme: ThemeId, story: WeekContent['story']): (string | null)[] {
  return story.pages.map((p, i) => {
    const given = story.icons?.[i];
    if (given && iconById(theme, given) && mentionsIcon(theme, p, given)) return given;
    return storyIcon(theme, p);
  });
}

/** A group of `n` icons in rows, centered on (cx, top). Returns the height used. */
function iconGroup(items: Item[], theme: ThemeId, id: string | null, n: number, cx: number, top: number, size: number, perRow: number, crossFrom = Infinity): number {
  const gap = size * 0.18;
  const rows = Math.ceil(n / perRow);
  for (let k = 0; k < n; k++) {
    const r = Math.floor(k / perRow), c = k % perRow;
    const inRow = Math.min(perRow, n - r * perRow);
    const x = cx - ((inRow - 1) * (size + gap)) / 2 + c * (size + gap);
    const y = top + size / 2 + r * (size + gap);
    if (id) drawIcon(items, theme, id, x, y, size);
    else items.push({ kind: 'path', d: circlePath(x, y, size * 0.4), color: INK, width: 1.6 });
    if (k >= crossFrom) {
      const q = size * 0.42;
      items.push({ kind: 'line', x1: x - q, y1: y - q, x2: x + q, y2: y + q, color: '#d9534f', width: 2.6 });
      items.push({ kind: 'line', x1: x + q, y1: y - q, x2: x - q, y2: y + q, color: '#d9534f', width: 2.6 });
    }
  }
  return rows * size + (rows - 1) * gap;
}

/** Name/Date header with the child's name written in, and a big title with a theme picture. */
function themedTop(items: Item[], w: number, name: string, theme: ThemeId, title: string, note?: string, icon?: string): number {
  header(items, w);
  const who = styleName(name, 'capital');
  if (who) items.push({ kind: 'text', x: M + 44, y: 53, size: 14, text: who, color: INK, align: 'left' });
  drawIcon(items, theme, icon ?? THEMES[theme].cover, w - M - 26, 102, 52);
  items.push({ kind: 'text', x: M, y: 100, size: 21, text: title, color: INK, align: 'left' });
  return note ? para(items, note, M, 122, 11.5, w - 2 * M - 70, COLORS.quiet) + 8 : 124;
}

const answerBox = (items: Item[], x: number, y: number, s = 46) => items.push({ kind: 'path', d: box(x, y, s, s), color: INK, width: 1.4 });
const plusSign = (items: Item[], x: number, y: number, r = 10) => {
  items.push({ kind: 'line', x1: x - r, y1: y, x2: x + r, y2: y, color: INK, width: 3 });
  items.push({ kind: 'line', x1: x, y1: y - r, x2: x, y2: y + r, color: INK, width: 3 });
};
const equalsSign = (items: Item[], x: number, y: number, r = 10) => {
  items.push({ kind: 'line', x1: x - r, y1: y - 5, x2: x + r, y2: y - 5, color: INK, width: 3 });
  items.push({ kind: 'line', x1: x - r, y1: y + 5, x2: x + r, y2: y + 5, color: INK, width: 3 });
};

// ---------- Page options ----------

export interface ThemedOptions {
  name: string;
  theme: ThemeId;
  paper: Paper;
  credit: boolean;
  label: string;         // footer label, e.g. "Week 3: Letter T"
  seed: string;
}
const dims = (o: ThemedOptions) => PAPER[o.paper];
const done = (o: ThemedOptions, items: Item[]): Page => { const { w, h } = dims(o); footer(items, w, h, o.credit, o.label); return { w, h, items }; };
const iconsFor = (o: ThemedOptions) => smallIcons(o.theme);

// ---------- 1. Count and color ----------

/** Trace the number, count a group of theme pictures, then color that many in a row. */
export function themedCountPage(o: ThemedOptions, n: number): Page {
  const { w } = dims(o);
  const items: Item[] = [];
  const pick = iconsFor(o);
  const rand = rng(o.seed + 'count');
  const main = pick[Math.floor(rand() * pick.length)];
  const other = pick.find((i) => i.id !== main.id) ?? main;
  let y = themedTop(items, w, o.name, o.theme, `The number ${n}`, `Trace ${n}. Count the ${main.many}. Then color ${n} ${plural(n, other)}.`, main.id);

  const cap = 50;
  drawCell(items, String(n), M, w - M, y + 4, cap, { practice: 'trace-write', startDots: true, model: true });
  y += 4 + cap * 1.5 + 24;

  // A framed group of exactly n pictures, scattered on a loose grid so it's countable.
  const boxH = n > 10 ? 190 : 150;
  items.push({ kind: 'path', d: box(M, y, w - 2 * M - 90, boxH, 12), color: INK, width: 1.4 });
  const cols = n > 10 ? 7 : 5, rows = n > 10 ? 3 : 2;
  const cellW = (w - 2 * M - 90) / cols, cellH = boxH / rows;
  const slots = Array.from({ length: cols * rows }, (_, i) => i);
  for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
  const size = Math.min(cellW, cellH) * 0.78;
  for (const s of slots.slice(0, n).sort((a, b) => a - b)) {
    const c = s % cols, r = Math.floor(s / cols);
    const jx = (rand() - 0.5) * (cellW - size) * 0.6, jy = (rand() - 0.5) * (cellH - size) * 0.6;
    drawIcon(items, o.theme, main.id, M + c * cellW + cellW / 2 + jx, y + r * cellH + cellH / 2 + jy, size);
  }
  items.push({ kind: 'text', x: w - M - 45, y: y + boxH / 2 - 34, size: 11, text: 'How many?', color: COLORS.quiet, align: 'center' });
  answerBox(items, w - M - 70, y + boxH / 2 - 22, 50);
  y += boxH + 30;

  // Color n: a row (or two rows) of 10 pictures.
  items.push({ kind: 'text', x: M, y, size: 13, text: `Color ${n} ${plural(n, other)}.`, color: INK, align: 'left' });
  y += 14;
  const total = n > 10 ? 20 : 10;
  const sz = Math.min(44, (w - 2 * M) / 10 - 6);
  const gapX = (w - 2 * M) / 10;
  for (let i = 0; i < total; i++) {
    const c = i % 10, r = Math.floor(i / 10);
    drawIcon(items, o.theme, other.id, M + gapX * c + gapX / 2, y + sz / 2 + r * (sz + 10), sz);
  }
  return done(o, items);
}

// ---------- 2. Ten frames ----------

function tenFrameIcons(items: Item[], theme: ThemeId, x: number, y: number, cell: number, a: number, aId: string, b = 0, bId = aId) {
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
    const xx = x + c * cell, yy = y + r * cell, k = r * 5 + c;
    items.push({ kind: 'path', d: `M${f2(xx)} ${f2(yy)} H${f2(xx + cell)} V${f2(yy + cell)} H${f2(xx)} Z`, color: INK, width: 1.4 });
    if (k < a) drawIcon(items, theme, aId, xx + cell / 2, yy + cell / 2, cell * 0.78);
    else if (k < a + b) drawIcon(items, theme, bId, xx + cell / 2, yy + cell / 2, cell * 0.78);
  }
}

/** Four ten frames filled with theme pictures. Number weeks: how many? Adding weeks: two kinds of pictures, how many in all? */
export function themedTenFramePage(o: ThemedOptions, step: MathStep): Page {
  const { w, h } = dims(o);
  const items: Item[] = [];
  const pick = iconsFor(o);
  const rand = rng(o.seed + 'tf');
  const A = pick[0], B = pick.find((i) => i.id !== A.id) ?? A;
  const add = !!step.addTo;
  const n = step.number ?? 5;
  const top = themedTop(items, w, o.name, o.theme, add ? 'Ten frame adding' : 'Ten frames',
    add ? `Count the ${A.many} and the ${B.many} in each frame. Write how many in all.` : `Count the ${A.many} in each ten frame. Write how many.`, A.id);
  const big = !add && n > 10;
  // Numbers: the week's number and its neighbors (or sums within 5 or 10).
  const rows: [number, number][] = [];
  const max = add ? step.addTo! : big ? Math.min(20, n + 3) : Math.max(5, Math.min(10, n + 3));
  const min = big ? 11 : 1;
  const want = big ? 3 : 4;
  rows.push(add ? [Math.max(1, Math.floor(max / 2)), Math.max(1, Math.ceil(max / 2) - (max % 2 ? 0 : 1))] : [n, 0]);
  for (let tries = 0; rows.length < want && tries < 200; tries++) {
    if (add) {
      const a = 1 + Math.floor(rand() * (max - 1)), b = 1 + Math.floor(rand() * (max - a));
      if (!rows.some(([x, y]) => x === a && y === b)) rows.push([a, b]);
    } else {
      const v = min + Math.floor(rand() * (max - min + 1));
      if (!rows.some(([x]) => x === v)) rows.push([v, 0]);
    }
  }
  for (let i = rows.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }

  const rowH = (h - M - 40 - top) / want;
  const frames = big ? 2 : 1;
  const cell = Math.min(46, (rowH - 30) / 2, (w - 2 * M - 130 - (frames - 1) * 16) / (5 * frames));
  rows.forEach(([a, b], i) => {
    const yTop = top + i * rowH + (rowH - cell * 2) / 2;
    const fw = frames * cell * 5 + (frames - 1) * 16;
    const x0 = M + (w - 2 * M - 110 - fw) / 2;
    if (big) {
      tenFrameIcons(items, o.theme, x0, yTop, cell, Math.min(10, a), A.id);
      tenFrameIcons(items, o.theme, x0 + cell * 5 + 16, yTop, cell, Math.max(0, a - 10), A.id);
    } else tenFrameIcons(items, o.theme, x0, yTop, cell, a, A.id, b, B.id);
    if (add) {
      items.push({ kind: 'text', x: w - M - 50, y: yTop + cell - 12, size: 15, text: `${a} + ${b} =`, color: INK, align: 'center' });
    }
    answerBox(items, w - M - 75, yTop + cell - (add ? 2 : 25), 50);
    if (i < rows.length - 1) items.push({ kind: 'line', x1: M, y1: top + (i + 1) * rowH, x2: w - M, y2: top + (i + 1) * rowH, color: COLORS.desc, width: 0.8, dash: [3, 4] });
  });
  return done(o, items);
}

// ---------- 3. Adding with pictures ----------

/** Picture addition: a group plus a group, write how many in all. Sums up to `max`. */
export function themedAdditionPage(o: ThemedOptions, max: 5 | 10): Page {
  const { w, h } = dims(o);
  const items: Item[] = [];
  const pick = iconsFor(o);
  const rand = rng(o.seed + 'add');
  const count = 5;
  const top = themedTop(items, w, o.name, o.theme, `Adding within ${max}`, 'Count both groups. Write how many in all.');
  const probs: [number, number][] = [];
  for (let t = 0; probs.length < count && t < 300; t++) {
    const a = 1 + Math.floor(rand() * (max - 1)), b = 1 + Math.floor(rand() * (max - a));
    if (!probs.some(([x, y]) => x === a && y === b)) probs.push([a, b]);
  }
  const rowH = (h - M - 36 - top) / count;
  const span = w - 2 * M;
  const groupW = span * 0.3;
  probs.forEach(([a, b], i) => {
    const ic = pick[i % pick.length];
    const yMid = top + rowH * i + rowH / 2;
    const perRow = 5;
    const size = Math.min(30, (groupW - 4 * 5) / perRow, (rowH - 26) / 2.2);
    const xA = M + groupW / 2, xB = M + groupW + 34 + groupW / 2;
    const ha = Math.ceil(a / perRow) * size * 1.18, hb = Math.ceil(b / perRow) * size * 1.18;
    iconGroup(items, o.theme, ic.id, a, xA, yMid - ha / 2, size, perRow);
    plusSign(items, M + groupW + 17, yMid);
    iconGroup(items, o.theme, ic.id, b, xB, yMid - hb / 2, size, perRow);
    const xEq = M + groupW * 2 + 34 + 26;
    equalsSign(items, xEq, yMid);
    answerBox(items, xEq + 28, yMid - 24, 48);
    items.push({ kind: 'text', x: w - M, y: yMid + 6, size: 13, text: `${a} + ${b}`, color: COLORS.quiet, align: 'right' });
    if (i < count - 1) items.push({ kind: 'line', x1: M, y1: top + rowH * (i + 1), x2: w - M, y2: top + rowH * (i + 1), color: COLORS.desc, width: 0.8, dash: [3, 4] });
  });
  return done(o, items);
}

// ---------- 4. More or less ----------

/** Two groups of theme pictures per row. Circle the group with more (Kindergarten also gets "fewer" rows). */
export function themedMoreLessPage(o: ThemedOptions, max: number, fewerToo: boolean): Page {
  const { w, h } = dims(o);
  const items: Item[] = [];
  const pick = iconsFor(o);
  const rand = rng(o.seed + 'ml');
  const count = 4;
  const top = themedTop(items, w, o.name, o.theme, fewerToo ? 'More or fewer?' : 'Which has more?',
    fewerToo ? 'Count each group. Circle the group the row asks for.' : 'Count each group. Circle the group with more.');
  const rowH = (h - M - 36 - top) / count;
  const boxW = (w - 2 * M - 30) / 2;
  const hi = Math.max(4, Math.min(10, max));
  for (let i = 0; i < count; i++) {
    let a = 1 + Math.floor(rand() * hi), b = 1 + Math.floor(rand() * hi);
    while (a === b) b = 1 + Math.floor(rand() * hi);
    const ask = fewerToo && i % 2 === 1 ? 'fewer' : 'more';
    const ic = pick[i % pick.length];
    const yTop = top + rowH * i + 22;
    const bh = rowH - 34;
    items.push({ kind: 'text', x: M, y: yTop - 6, size: 12, text: `Circle the group with ${ask}.`, color: COLORS.quiet, align: 'left' });
    [a, b].forEach((n, k) => {
      const x = M + k * (boxW + 30);
      items.push({ kind: 'path', d: box(x, yTop, boxW, bh, 10), color: COLORS.quiet, width: 1, dash: [4, 3] });
      const perRow = 5;
      const rows = Math.ceil(n / perRow);
      const size = Math.min(34, (boxW - 30) / perRow - 6, (bh - 16) / rows - 4);
      const gh = rows * size * 1.18;
      iconGroup(items, o.theme, ic.id, n, x + boxW / 2, yTop + (bh - gh) / 2, size, perRow);
    });
  }
  return done(o, items);
}

// ---------- 5. Word problems ----------

/** The week's word problems, each with a picture to count and a box for the answer. */
export function wordProblemsPage(o: ThemedOptions, problems: WeekContent['wordProblems']): Page {
  const { w, h } = dims(o);
  const items: Item[] = [];
  const list = problems.slice(0, 6);
  const top = themedTop(items, w, o.name, o.theme, `${THEMES[o.theme].label} word problems`, 'Read each one out loud together. Count the pictures, then write the answer in the box.');
  const rowH = (h - M - 34 - top) / list.length;
  const textMax = w - 2 * M - 34;
  list.forEach((q, i) => {
    const yTop = top + rowH * i;
    const ic = problemIcon(o.theme, q.text, q.icon, [q.a, q.b])?.id ?? null;
    // Number badge and the problem text.
    items.push({ kind: 'path', d: circlePath(M + 11, yTop + 13, 11), color: INK, width: 1.3 });
    items.push({ kind: 'text', x: M + 11, y: yTop + 17.5, size: 12, text: String(i + 1), color: INK, align: 'center' });
    const size = list.length > 4 ? 12.5 : 13.5;
    const lines = wrap(personalize(q.text, o.name), size, textMax);
    let ty = yTop + 18;
    for (const l of lines.slice(0, 3)) { items.push({ kind: 'text', x: M + 32, y: ty, size, text: l, color: INK, align: 'left' }); ty += size * 1.32; }
    // Picture row under the text, answer box on the right.
    const picTop = ty + 2;
    const picH = yTop + rowH - 10 - picTop;
    const isz = Math.max(16, Math.min(list.length > 4 ? 32 : 40, picH * 0.9));
    const perRow = 10;
    const pw = w - 2 * M - 110;
    const cy0 = picTop;
    if (q.op === 'compare') {
      const half = pw / 2;
      iconGroup(items, o.theme, ic, q.a, M + 32 + half / 2 - 10, cy0, Math.min(isz, (half - 30) / Math.min(perRow, Math.max(q.a, q.b)) - 3), perRow);
      items.push({ kind: 'line', x1: M + 32 + half, y1: cy0, x2: M + 32 + half, y2: cy0 + isz, color: COLORS.desc, width: 1 });
      iconGroup(items, o.theme, ic, q.b, M + 32 + half * 1.5 + 10, cy0, Math.min(isz, (half - 30) / Math.min(perRow, Math.max(q.a, q.b)) - 3), perRow);
    } else if (q.op === '+') {
      const tot = q.a + q.b;
      const s = Math.min(isz, (pw - 30) / tot - 4);
      const wa = q.a * (s * 1.18), wb = q.b * (s * 1.18);
      const x0 = M + 32;
      iconGroup(items, o.theme, ic, q.a, x0 + wa / 2, cy0, s, perRow);
      plusSign(items, x0 + wa + 12, cy0 + s / 2, 7);
      iconGroup(items, o.theme, ic, q.b, x0 + wa + 24 + wb / 2, cy0, s, perRow);
    } else {
      const s = Math.min(isz, (pw - 10) / q.a - 4);
      iconGroup(items, o.theme, ic, q.a, M + 32 + (q.a * s * 1.18) / 2, cy0, s, perRow, q.a - q.b);
    }
    answerBox(items, w - M - 52, Math.max(yTop + 4, picTop + isz / 2 - 24), 48);
    if (i < list.length - 1) items.push({ kind: 'line', x1: M, y1: yTop + rowH, x2: w - M, y2: yTop + rowH, color: COLORS.desc, width: 0.8, dash: [3, 4] });
  });
  return done(o, items);
}

// ---------- 6. Little book ----------

/**
 * What goes on the 6 inside pages of the little book: the words (with the name in) and the picture for each.
 * Pictures are decided on the story as written (with {{name}}), one per page: the story's own pick when that page
 * names it, else the thing the page names first, else the buddy if the page is about the buddy, else null (a
 * "Draw it!" box). A picture can repeat: two pages about the T-rex both show the T-rex. Spare pages start "DRAW:".
 */
export function littleBookPlan(o: Pick<ThemedOptions, 'name' | 'theme'>, story: WeekContent['story']): { pages: string[]; pics: (string | null)[] } {
  const T = THEMES[o.theme];
  const pages = story.pages.map((p) => personalize(p, o.name));
  const pics = storyPictures(o.theme, story);
  // Fit the story into the 6 inside pages: merge the shortest neighbors if there are more than 6.
  // The merged page keeps the first of the two pictures (its words are on the page too).
  while (pages.length > 6) {
    let best = 0;
    for (let i = 0; i < pages.length - 1; i++) if (pages[i].length + pages[i + 1].length < pages[best].length + pages[best + 1].length) best = i;
    pages.splice(best, 2, `${pages[best]} ${pages[best + 1]}`);
    pics.splice(best, 2, pics[best] ?? pics[best + 1]);
  }
  const who = styleName(o.name, 'capital') || 'Little One';
  const spare = [`Draw ${who} ${T.place}.`, 'Draw your favorite part of the story.'];
  while (pages.length < 6) { pages.push(`DRAW:${spare[(pages.length) % 2]}`); pics.push(null); }
  return { pages, pics };
}

/**
 * The story as a little book: one sheet, 8 panels, cut once and folded (no stapler needed).
 * Landscape. Bottom row reads normally: page 6, page 7, back cover, front cover.
 * Top row is upside down: pages 5, 4, 3, 2. Pages 2 to 7 hold the story; spare pages become drawing pages.
 */
export function littleBookPage(o: ThemedOptions, story: WeekContent['story'], buddyIcon?: string): Page {
  const P = PAPER[o.paper];
  const w = P.h, h = P.w; // landscape
  const items: Item[] = [];
  const T = THEMES[o.theme];
  const cw = w / 4, ch = h / 2;
  // Fold and cut guides.
  for (let c = 1; c < 4; c++) items.push({ kind: 'line', x1: c * cw, y1: 10, x2: c * cw, y2: h - 10, color: COLORS.desc, width: 0.8, dash: [4, 4] });
  items.push({ kind: 'line', x1: 10, y1: ch, x2: cw, y2: ch, color: COLORS.desc, width: 0.8, dash: [4, 4] });
  items.push({ kind: 'line', x1: 3 * cw, y1: ch, x2: w - 10, y2: ch, color: COLORS.desc, width: 0.8, dash: [4, 4] });
  items.push({ kind: 'line', x1: cw, y1: ch, x2: 3 * cw, y2: ch, color: '#d9534f', width: 1.2, dash: [7, 4] });
  items.push({ kind: 'text', x: w / 2, y: ch - 5, size: 7.5, text: 'cut on the red line only', color: '#d9534f', align: 'center' });

  const who = styleName(o.name, 'capital') || 'Little One';
  const { pages, pics } = littleBookPlan(o, story);

  // panel: page number (1 = front cover, 8 = back cover), column, row (0 = top, upside down)
  const layout: [number, number, number][] = [[5, 0, 0], [4, 1, 0], [3, 2, 0], [2, 3, 0], [6, 0, 1], [7, 1, 1], [8, 2, 1], [1, 3, 1]];
  for (const [pg, col, row] of layout) {
    const flip = row === 0;
    const x0 = col * cw, y0 = row * ch;
    // Draw as if upright inside the panel, then mirror both axes for the top row.
    const X = (x: number) => (flip ? x0 + cw - x : x0 + x);
    const Y = (y: number) => (flip ? y0 + ch - y : y0 + y);
    const text = (x: number, y: number, size: number, t: string, color = INK) =>
      items.push({ kind: 'text', x: X(x), y: Y(y), size, text: t, color, align: 'center', rotate: flip ? 180 : undefined });
    const icon = (id: string, x: number, y: number, s: number) => drawIcon(items, o.theme, id, X(x), Y(y), s, flip);
    const pad = 16;
    const inner = cw - 2 * pad;
    if (pg === 1) {
      const lines = wrap(personalize(story.title, o.name), 17, inner);
      let ty = 40;
      for (const l of lines.slice(0, 4)) { text(cw / 2, ty, 17, l); ty += 21; }
      icon(T.cover, cw / 2, ty + 70, 120);
      text(cw / 2, ch - 46, 10, `A little book for ${who}`, COLORS.quiet);
      text(cw / 2, ch - 30, 10, 'Cut, fold and read together', COLORS.quiet);
    } else if (pg === 8) {
      text(cw / 2, 56, 20, 'The end');
      icon(buddyIcon ?? T.buddy.icon, cw / 2, 140, 96);
      text(cw / 2, ch - 54, 9.5, 'Read it again tomorrow. Point to', COLORS.quiet);
      text(cw / 2, ch - 41, 9.5, 'each word as you read.', COLORS.quiet);
      text(cw / 2, ch - 22, 7.5, SITE.domain, COLORS.quiet);
    } else {
      const raw = pages[pg - 2];
      if (raw.startsWith('DRAW:')) {
        const lines = wrap(raw.slice(5), 12, inner);
        let ty = 30;
        for (const l of lines) { text(cw / 2, ty, 12, l); ty += 15; }
        // A drawing frame (drawn as a path so it flips with the panel).
        const fx = pad, fy = ty + 2, fw = inner, fh = ch - 34 - fy;
        items.push({ kind: 'path', d: box(Math.min(X(fx), X(fx + fw)), Math.min(Y(fy), Y(fy + fh)), fw, fh, 8), color: COLORS.quiet, width: 1, dash: [4, 3] });
      } else {
        const pic = pics[pg - 2];
        if (pic) icon(pic, cw / 2, 78, 104);
        else {
          // Nothing on this page has a picture: a small dashed box to draw in, never an unrelated picture.
          const bw = 108, bh = 84, bx = cw / 2 - bw / 2, by = 78 - bh / 2;
          items.push({ kind: 'path', d: box(Math.min(X(bx), X(bx + bw)), Math.min(Y(by), Y(by + bh)), bw, bh, 8), color: COLORS.quiet, width: 1, dash: [4, 3] });
          text(cw / 2, 82, 11, 'Draw it!', COLORS.quiet);
        }
        const size = raw.length > 150 ? 10.5 : raw.length > 105 ? 11.5 : 12.5;
        const lines = wrap(raw, size, inner);
        let ty = 152;
        for (const l of lines.slice(0, 9)) { text(cw / 2, ty, size, l); ty += size * 1.36; }
      }
      text(cw / 2, ch - 16, 8, String(pg - 1), COLORS.quiet);
    }
  }
  if (o.credit) items.push({ kind: 'text', x: w - 12, y: h - 4, size: 6.5, text: `Free printable from ${SITE.domain}`, color: COLORS.quiet, align: 'right' });
  return { w, h, items };
}

/** How to fold the little book, for the plan page. */
export const LITTLE_BOOK_HOW = 'Fold the page in half both ways and open it. Cut only the red line, fold it in half the long way, push the ends together, then fold it into a book.';

// ---------- 7. Tracing sentence ----------

/** The week's sentence about their interest: read it, trace it, then copy it, with a box to draw it. */
export function tracingSentencePage(o: ThemedOptions, sentence: string, level: 'pre-k' | 'kindergarten'): Page {
  const { w, h } = dims(o);
  const items: Item[] = [];
  const text = cleanTraceText(personalize(sentence, o.name));
  let y = themedTop(items, w, o.name, o.theme, 'Trace the sentence', level === 'pre-k' ? 'Read the sentence together, pointing to each word. Then trace it.' : 'Read it, trace it, then write it on your own on the last lines.');
  const avail = w - 2 * M - 24;
  const pre = level === 'pre-k';
  let cap = pre ? 40 : 32;
  let rows = wrapToWidth(text, avail / cap);
  while (rows.length > (pre ? 2 : 3) && cap > 24) { cap -= 2; rows = wrapToWidth(text, avail / cap); }
  const pitch = cap * 1.5 + Math.max(16, cap * 0.42);
  const drawBox = 150;
  const bottom = h - M - 30 - drawBox - 20;
  const guideOnly = { practice: 'trace' as const, startDots: false, model: false };
  const plan: ('model' | 'trace' | 'blank')[] = [];
  for (let k = 0; k < 6; k++) plan.push(k === 0 ? 'model' : pre || k < 3 ? 'trace' : 'blank');
  y += 4;
  outer: for (const kind of plan) {
    for (const r of rows) {
      if (y + cap * 1.5 > bottom) break outer;
      drawCell(items, '', M, w - M, y, cap, guideOnly);
      if (kind !== 'blank') drawText(items, r, M + 12, y + cap, cap, kind, kind === 'trace');
      y += pitch;
    }
    y += 6;
  }
  const by = h - M - 30 - drawBox;
  items.push({ kind: 'text', x: M, y: by - 8, size: 11, text: 'Draw a picture of the sentence.', color: COLORS.quiet, align: 'left' });
  items.push({ kind: 'path', d: box(M, by, w - 2 * M, drawBox, 12), color: INK, width: 1.2 });
  drawIcon(items, o.theme, THEMES[o.theme].buddy.icon, w - M - 34, by + drawBox - 32, 44);
  return done(o, items);
}

// ---------- Themed coloring (bubble letters with theme pictures) ----------

export function themedColoring(bubble: LoadedFont | null, theme: ThemeId, paper: Paper) {
  return (raw: string, caps: boolean): Page | null => {
    if (!bubble) return null;
    // The bubble letter page fits about 16 letters; a long full name uses the first name.
    const text = raw.length > 14 && raw.includes(' ') ? raw.split(' ')[0] : raw;
    const ids = THEMES[theme].icons.map((i) => i.id);
    return buildColoringPage(bubble, { name: text, theme: 'stars', paper, credit: false, caps, decorate: (x, y, r, i) => {
      const it: Item[] = [];
      drawIcon(it, theme, ids[i % ids.length], x, y, r * 1.9);
      return it;
    } });
  };
}

// ---------- 8. Plan page with the parent note ----------

export interface DayPlan { day: string; parts: { title: string; how: string }[] }

export interface PlanPageInput {
  name: string; theme: ThemeId; paper: Paper; credit: boolean; label: string;
  heading: string;       // "Week 3 of 36 · Pre-K at home, personalized"
  title: string;         // "Letter T"
  minutes: number;
  days: DayPlan[];
  note: WeekContent['parentNote'];
  verse?: { ref: string; text: string };
}

/** The grown-up's page: what this week teaches and why, the day by day plan, and ideas away from the paper. Shrinks to fit one page. */
export function programPlanPage(p: PlanPageInput): Page {
  const { w, h } = PAPER[p.paper];
  const limit = h - M - 22;
  for (const k of [1, 0.94, 0.88, 0.82, 0.76]) {
    const pg = planAt(p, k, w, h);
    if (pg.bottom <= limit || k === 0.76) return pg.page;
  }
  throw new Error('unreachable');
}

function planAt(p: PlanPageInput, k: number, w: number, h: number): { page: Page; bottom: number } {
  const items: Item[] = [];
  const T = THEMES[p.theme];
  const who = styleName(p.name, 'capital');
  const sz = (n: number) => Math.round(n * k * 10) / 10;
  const textW2 = w - 2 * M - 92;
  items.push({ kind: 'text', x: M, y: 56, size: sz(11), text: p.heading, color: COLORS.quiet, align: 'left' });
  const titleLines = wrap(who ? `${who}'s week: ${p.title}` : `This week: ${p.title}`, sz(24), textW2);
  let y = 88;
  for (const l of titleLines) { items.push({ kind: 'text', x: M, y, size: sz(24), text: l, color: INK, align: 'left' }); y += sz(24) * 1.15; }
  drawIcon(items, p.theme, T.cover, w - M - 40, 84, 80);
  y = para(items, `${T.label} theme. About ${p.minutes} minutes a day. Tick each box when you finish, and stop while it's still fun.`, M, y + 2, sz(11.5), textW2, COLORS.quiet) + 8;

  // What this week teaches, and why, in a soft box.
  const noteTop = y;
  items.push({ kind: 'text', x: M + 14, y: noteTop + 20, size: sz(9.5), text: 'WHAT THIS WEEK TEACHES, AND WHY', color: COLORS.quiet, align: 'left' });
  y = para(items, personalize(p.note.teaches, p.name), M + 14, noteTop + 20 + sz(17), sz(11.5), w - 2 * M - 28) + 2;
  y = para(items, personalize(p.note.why, p.name), M + 14, y, sz(11.5), w - 2 * M - 28, COLORS.quiet) - sz(4);
  items.unshift({ kind: 'path', d: box(M, noteTop, w - 2 * M, y - noteTop + 6, 10), color: COLORS.desc, width: 1.2, fill: '#f5f8fd' });
  y += 14;

  for (const d of p.days) {
    y += sz(8);
    items.push({ kind: 'text', x: M, y: y + sz(13), size: sz(13), text: d.day, color: INK, align: 'left' });
    y += sz(13) + sz(9);
    for (const part of d.parts) {
      items.push({ kind: 'path', d: box(M + 4, y - 1, sz(12), sz(12), 2.5), color: INK, width: 1.1 });
      items.push({ kind: 'text', x: M + 4 + sz(20), y: y + sz(10), size: sz(11.5), text: part.title, color: INK, align: 'left' });
      y = para(items, part.how, M + 4 + sz(20), y + sz(10) + sz(14), sz(10.5), w - 2 * M - 30, COLORS.quiet) + sz(3);
    }
  }

  if (p.verse) {
    y += sz(8);
    items.push({ kind: 'line', x1: M, y1: y, x2: w - M, y2: y, color: COLORS.desc, width: 1 });
    items.push({ kind: 'text', x: M, y: y + sz(18), size: sz(12.5), text: `Verse of the week (${p.verse.ref}, BSB)`, color: INK, align: 'left' });
    y = para(items, `"${p.verse.text}"`, M, y + sz(36), sz(11.5), w - 2 * M) + 2;
  }

  if (p.note.activities.length) {
    y += sz(8);
    items.push({ kind: 'line', x1: M, y1: y, x2: w - M, y2: y, color: COLORS.desc, width: 1 });
    items.push({ kind: 'text', x: M, y: y + sz(18), size: sz(12.5), text: 'Away from the paper', color: INK, align: 'left' });
    y += sz(18) + sz(18);
    for (const a of p.note.activities.slice(0, 3)) {
      drawIcon(items, p.theme, smallIcons(p.theme)[0].id, M + 6, y - sz(4), sz(12));
      y = para(items, personalize(a, p.name), M + 18, y, sz(11), w - 2 * M - 18) + sz(4);
    }
  }
  footer(items, w, h, p.credit, p.label);
  return { page: { w, h, items }, bottom: y };
}

// ---------- Placement "show me" page ----------

/**
 * An optional printable for the placement check: letters, sounds, words, numbers, counting and adding for the
 * child to show the grown-up, who ticks the small box next to each one the child gets right.
 */
export function showMePage(paper: Paper, theme: ThemeId = 'dinosaurs'): Page {
  const { w, h } = PAPER[paper];
  const items: Item[] = [];
  items.push({ kind: 'text', x: M, y: 56, size: 11, text: 'Tracelings at Home, personalized: placement check', color: COLORS.quiet, align: 'left' });
  drawIcon(items, theme, THEMES[theme].cover, w - M - 26, 70, 50);
  items.push({ kind: 'text', x: M, y: 88, size: 23, text: 'Show me what you know', color: INK, align: 'left' });
  let y = para(items, 'For the grown-up: point to each one and ask. Tick the little box when your child gets it. Stop if it stops being fun and finish another day. Then answer the questions at tracelings.com/program.', M, 110, 11, w - 2 * M - 60, COLORS.quiet) + 12;

  const tick = (x: number, yy: number) => items.push({ kind: 'path', d: box(x, yy, 11, 11, 2), color: COLORS.quiet, width: 0.9 });
  const section = (t: string, sub: string) => {
    items.push({ kind: 'text', x: M, y, size: 13, text: t, color: INK, align: 'left' });
    items.push({ kind: 'text', x: M, y: y + 15, size: 10, text: sub, color: COLORS.quiet, align: 'left' });
    y += 24;
  };
  const grid = (cells: string[], cols: number, cellH: number, cap: number) => {
    const cw = (w - 2 * M) / cols;
    cells.forEach((t, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const cx = M + c * cw + cw / 2 - 6, top = y + r * cellH;
      const fit = Math.min(cap, (cw * 0.62) / Math.max(0.1, layoutWord(t).width));
      centered(items, t, cx, top + cellH * 0.5 + fit * 0.4, fit);
      tick(M + (c + 1) * cw - 16, top + 4);
    });
    y += Math.ceil(cells.length / cols) * cellH + 18;
  };
  section('1. Capital letters', 'Point to a letter: "What letter is this?"');
  grid(['S', 'A', 'T', 'P', 'M', 'B', 'D', 'G', 'R', 'E'], 10, 40, 24);
  section('2. Lowercase letters and their sounds', 'Name the letter, then "What sound does it make?" Tick only if both are right.');
  grid(['s', 'a', 't', 'i', 'p', 'n', 'm', 'd', 'b', 'f'], 10, 40, 24);
  section('3. Read these words', 'Sound them out together if needed: c-a-t, cat.');
  grid(['cat', 'sun', 'pig', 'hop', 'the', 'and'], 6, 40, 24);
  section('4. Numbers', '"What number is this?"');
  grid(['1', '3', '5', '7', '9', '12', '15', '20'], 8, 40, 24);
  section('5. Count', '"How many?" Let them touch each picture once.');
  const cw = (w - 2 * M) / 3;
  const ids = smallIcons(theme);
  [4, 8, 13].forEach((n, i) => {
    const x0 = M + i * cw;
    const s = 20;
    for (let k = 0; k < n; k++) drawIcon(items, theme, ids[i % ids.length].id, x0 + 14 + (k % 5) * (s + 6), y + 14 + Math.floor(k / 5) * (s + 6), s);
    tick(x0 + cw - 22, y + 4);
  });
  y += 92;
  section('6. Add', 'Use fingers or toys: "2 and 1 more?"');
  const sw = (w - 2 * M) / 4;
  ['2 + 1', '3 + 2', '4 + 3', '5 + 5'].forEach((t, i) => {
    items.push({ kind: 'text', x: M + i * sw + sw / 2 - 8, y: y + 22, size: 20, text: `${t} =`, color: INK, align: 'center' });
    tick(M + (i + 1) * sw - 22, y + 8);
  });
  y += 52;
  section('7. Their name', 'Ask them to write their first name. Wobbly is fine.');
  y += 6;
  items.push({ kind: 'line', x1: M, y1: y, x2: w - M, y2: y, color: COLORS.guide, width: 1 });
  items.push({ kind: 'line', x1: M, y1: y + 18, x2: w - M, y2: y + 18, color: COLORS.mid, width: 0.8, dash: [4, 3] });
  items.push({ kind: 'line', x1: M, y1: y + 36, x2: w - M, y2: y + 36, color: COLORS.guide, width: 1.2 });
  footer(items, w, h, true, 'Placement check');
  return { w, h, items };
}

// ---------- The whole week ----------

export interface ProgramWeekOptions {
  name: string;
  profile: ChildProfile;
  week: ProgramWeek;
  content: WeekContent;
  paper: Paper;
  credit: boolean;
  /** Bubble letter font for the coloring pages; they're left out while it loads (same as the free packs). */
  bubble?: LoadedFont | null;
  /** Total weeks in the child's plan, for the plan page heading. */
  planLength?: number;
}

/** The base week the pages are built from. Extra review weeks get a review version of it. */
function packWeek(pw: ProgramWeek): Week {
  const b = baseWeekOf(pw);
  const math = pw.math ?? (b.addTo ? { addTo: b.addTo } : { number: b.number });
  let w: Week = { ...b };
  if (pw.extraReview) {
    if (b.kind === 'letter' || b.kind === 'review') w = { ...b, kind: 'review', letters: reviewLetters(pw), title: weekTitle(pw) };
    else if (b.kind === 'family' || b.kind === 'vowel-review') {
      const fams = b.families ?? Object.keys(FAMILIES).filter((f) => f[1] === b.family![1] && PLANS.kindergarten.weeks.some((x) => x.family === f && x.n <= b.n));
      w = { ...b, kind: 'vowel-review', letters: [fams[0][0]], families: fams, title: weekTitle(pw), sightWords: [] };
    }
  }
  return { ...w, n: pw.index, number: math.addTo ? undefined : math.number, addTo: math.addTo };
}

interface Activity { title: string; how: string; min: number; pages: Page[] }

/**
 * Every page of a child's week: the plan page, the faith verse page when on, then the pages in day order.
 * Uses the free plan's letter, word family and sight word pages, plus the themed pages. The child's name
 * is swapped in here, in the browser, and nowhere else.
 */
export function buildProgramWeek(opts: ProgramWeekOptions): Page[] {
  const { name, profile, week, content, paper, credit } = opts;
  const theme = week.theme;
  const level = week.level;
  const label = `Week ${week.index}: ${weekTitle(week)}`;
  const base = packWeek(week);
  const step: MathStep = week.math ?? (base.addTo ? { addTo: base.addTo } : { number: base.number ?? 1 });
  const T: ThemedOptions = { name, theme, paper, credit, label, seed: `${profile.id}-${week.index}` };
  const po: PackOptions = { level, week: base, name, paper, credit, bubble: opts.bubble ?? null, faith: profile.faith, label, coloring: themedColoring(opts.bubble ?? null, theme, paper) };
  const days = weekDays(po);
  const who = styleName(name, 'capital') || 'your child';
  const n = step.number ?? 0;

  const mathMain: Activity = step.addTo
    ? { title: `Adding within ${step.addTo}`, how: 'Act out one problem with real objects first, then count the pictures on the page together.', min: 8, pages: [themedAdditionPage(T, step.addTo)] }
    : { title: `The number ${n}`, how: `Trace ${n}, count the pictures out loud, then color ${n}. Count real things too: steps, spoons, socks.`, min: 8, pages: [themedCountPage(T, n)] };
  const tenFrame: Activity = { title: 'Ten frames', how: 'Count each frame by touching every picture once. Notice that a full frame is always 10.', min: 6, pages: [themedTenFramePage(T, step)] };
  const moreMax = step.addTo ?? Math.max(5, Math.min(10, n + 2));
  const moreLess: Activity = { title: level === 'pre-k' ? 'Which has more?' : 'More or fewer', how: 'Count both groups out loud before circling. Lining up toy pieces side by side helps.', min: 5, pages: [themedMoreLessPage(T, moreMax, level === 'kindergarten')] };
  const book: Activity = { title: `Read ${who}'s little book`, how: `Cut and fold the book together (${LITTLE_BOOK_HOW.charAt(0).toLowerCase()}${LITTLE_BOOK_HOW.slice(1, -1)}). Read it aloud and let ${who} point to the pictures.`, min: 10, pages: [littleBookPage(T, content.story)] };
  const sentence: Activity = { title: 'Trace the sentence', how: 'Read it together first, pointing to each word, then trace it and draw a picture of it.', min: 7, pages: [tracingSentencePage(T, content.tracingSentence, level)] };
  const problems: Activity = { title: 'Word problems', how: 'Read each problem out loud. Count the pictures together, then write the answer.', min: 8, pages: [wordProblemsPage(T, content.wordProblems)] };
  const fromBase = (d: number): Activity => ({ title: days[d].title, how: days[d].how, min: 7, pages: days[d].pages });

  // Pace: shorter days drop the extra math practice. The order of the week never changes.
  const extras = profile.minutesPerDay >= 20 ? 2 : profile.minutesPerDay >= 15 ? 1 : 0;
  const groups: Activity[][] = [
    [book, fromBase(0)],
    [fromBase(1), sentence],
    [fromBase(2), ...(extras >= 2 ? [moreLess] : [])],
    [mathMain, ...(extras >= 1 ? [tenFrame] : [])],
    [fromBase(4), problems],
  ];
  // Three or four days a week: neighboring days share a day.
  const merged: { day: string; acts: Activity[] }[] = profile.daysPerWeek === 5
    ? groups.map((g, i) => ({ day: DAYS[i], acts: g }))
    : profile.daysPerWeek === 4
      ? [{ day: DAYS[0], acts: groups[0] }, { day: DAYS[1], acts: [...groups[1], ...groups[2]] }, { day: DAYS[3], acts: groups[3] }, { day: DAYS[4], acts: groups[4] }]
      : [{ day: DAYS[0], acts: [...groups[0], ...groups[1]] }, { day: DAYS[2], acts: [...groups[2], ...groups[3]] }, { day: DAYS[4], acts: groups[4] }];
  const real = merged.map((d) => ({ ...d, acts: d.acts.filter((a) => a.pages.length) }));

  const verse = profile.faith ? verseFor(week.index) : undefined;
  const plan = programPlanPage({
    name, theme, paper, credit, label,
    heading: `${PLANS[level].label} at home, personalized. Week ${week.index}${opts.planLength ? ` of ${opts.planLength}` : ''}`,
    title: weekTitle(week),
    minutes: profile.minutesPerDay,
    days: real.map((d) => ({ day: d.day, parts: d.acts.map((a) => ({ title: a.title, how: a.how })) })),
    note: content.parentNote,
    verse: verse ? { ref: verse.ref, text: verse.text } : undefined,
  });
  const pages: Page[] = [plan];
  if (profile.faith) pages.push(versePage(po, label));
  for (const d of real) for (const a of d.acts) pages.push(...a.pages);
  return pages;
}
