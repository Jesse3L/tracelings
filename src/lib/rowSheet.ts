// Row and grid tracing sheets built from the same ball-and-stick glyphs as sheet.ts.
// Used by the number range sheets (1-10, 1-20) and the free-text word tracing tool.
import { PAPER, COLORS, layoutWord, glyphFor, strokeToPath, type Item, type Page, type Paper, type LineSize, type Practice } from './sheet';
import { SITE } from '../config';

export const ROW_CAP: Record<LineSize, number> = { large: 64, medium: 46, small: 32 };
const M = 40;
const TOP0 = 92;
const INSET = 12;
const COL_GAP = 22;

export const pitchFor = (cap: number) => cap * 1.5 + Math.max(16, cap * 0.42);
const bottomOf = (paper: Paper) => PAPER[paper].h - M - 22;

/** How many handwriting rows fit on one page at this letter height. */
export function rowsPerPage(paper: Paper, cap: number): number {
  return Math.max(1, Math.floor((bottomOf(paper) - TOP0 - cap * 1.5) / pitchFor(cap)) + 1);
}

function header(items: Item[], w: number) {
  items.push({ kind: 'text', x: M, y: 56, size: 11, text: 'Name', color: COLORS.ink, align: 'left' });
  items.push({ kind: 'line', x1: M + 36, y1: 58, x2: M + 250, y2: 58, color: COLORS.quiet, width: 0.75 });
  items.push({ kind: 'text', x: w - M - 168, y: 56, size: 11, text: 'Date', color: COLORS.ink, align: 'left' });
  items.push({ kind: 'line', x1: w - M - 136, y1: 58, x2: w - M, y2: 58, color: COLORS.quiet, width: 0.75 });
}

function footer(items: Item[], w: number, h: number, credit: boolean) {
  if (credit) items.push({ kind: 'text', x: w / 2, y: h - M + 14, size: 8, text: `Free printable from ${SITE.domain}`, color: COLORS.quiet, align: 'center' });
}

function guides(items: Item[], x1: number, x2: number, yTop: number, cap: number) {
  items.push({ kind: 'line', x1, y1: yTop, x2, y2: yTop, color: COLORS.guide, width: 1 });
  items.push({ kind: 'line', x1, y1: yTop + cap * 0.5, x2, y2: yTop + cap * 0.5, color: COLORS.mid, width: 0.9, dash: [4, 3] });
  items.push({ kind: 'line', x1, y1: yTop + cap, x2, y2: yTop + cap, color: COLORS.guide, width: 1.2 });
  items.push({ kind: 'line', x1, y1: yTop + cap * 1.5, x2, y2: yTop + cap * 1.5, color: COLORS.desc, width: 0.7 });
}

/** Draws one copy of `text` with its left edge at x. */
export function drawText(items: Item[], text: string, x: number, yBase: number, cap: number, kind: 'model' | 'trace', startDots: boolean) {
  const { placed } = layoutWord(text);
  const color = kind === 'model' ? COLORS.model : COLORS.trace;
  const sw = kind === 'model' ? Math.max(2, cap * 0.055) : Math.max(1.4, cap * 0.042);
  const dash = kind === 'trace' ? [Math.max(2.2, cap * 0.075), Math.max(1.8, cap * 0.06)] : undefined;
  for (const p of placed) {
    const g = glyphFor(p.ch)!;
    const ox = x + p.x * cap;
    for (const s of g.strokes) items.push({ kind: 'path', d: strokeToPath(s, ox, yBase, cap), color, width: sw, dash });
    for (const [dx, dy] of g.dots ?? []) items.push({ kind: 'dot', cx: ox + dx * cap, cy: yBase + dy * cap, r: sw * 0.95, color });
    if (kind === 'trace' && startDots) {
      for (const s of g.strokes) items.push({ kind: 'dot', cx: ox + s[0][1] * cap, cy: yBase + s[0][2] * cap, r: Math.max(1.9, cap * 0.045), color: COLORS.start });
    }
  }
}

export interface CellStyle { practice: Practice; startDots: boolean; model: boolean }

/**
 * One handwriting cell: guide lines across [x1, x2] and the text repeated to fill it.
 * The first copy is solid when `model` is on and there is room for more than one copy.
 * "Trace, then write" leaves the end of the cell empty for writing on their own.
 * Returns how many copies were drawn and whether the cell had room left for writing.
 */
export function drawCell(items: Item[], text: string, x1: number, x2: number, yTop: number, cap: number, st: CellStyle): { reps: number; writeSpace: boolean } {
  guides(items, x1, x2, yTop, cap);
  if (!text.trim()) return { reps: 0, writeSpace: true };
  const avail = x2 - x1 - 2 * INSET;
  const oneW = layoutWord(text).width * cap;
  const gap = Math.max(cap * 0.9, 10);
  const reps = Math.max(1, Math.floor((avail + gap) / (oneW + gap)));
  let drawn = reps;
  if (st.practice === 'trace-write' && reps >= 3) drawn = Math.max(2, Math.ceil(reps * 0.6));
  const yBase = yTop + cap;
  // Copies start at the left. When every copy is drawn, leftover room is shared between the gaps (up to one extra gap).
  const extra = drawn === reps && reps > 1 ? Math.min(gap, (avail - (reps * oneW + (reps - 1) * gap)) / (reps - 1)) : 0;
  const step = oneW + gap + extra;
  for (let r = 0; r < drawn; r++) {
    const kind = st.model && reps >= 2 && r === 0 ? 'model' : 'trace';
    drawText(items, text, x1 + INSET + r * step, yBase, cap, kind, st.startDots);
  }
  return { reps, writeSpace: drawn < reps };
}

// ---------- Number range sheets ----------

export type RangeLayout = 'page' | 'rows';

export interface RangeOptions {
  from: number;
  to: number;
  layout: RangeLayout;
  size: LineSize;
  paper: Paper;
  practice: Practice;
  startDots: boolean;
  credit: boolean;
}

/** Biggest letter height (up to `max`) where `rows` handwriting rows fit on one page. */
function fitCap(paper: Paper, rows: number, max: number): number {
  for (let cap = max; cap > 12; cap -= 0.5) if (rowsPerPage(paper, cap) >= rows) return cap;
  return 12;
}

export function buildRangePages(o: RangeOptions): Page[] {
  const { w, h } = PAPER[o.paper];
  const nums: string[] = [];
  for (let n = o.from; n <= o.to; n++) nums.push(String(n));
  const st: CellStyle = { practice: o.practice, startDots: o.startDots, model: true };

  if (o.layout === 'page') {
    // Everything on one page: one column up to 10 numbers, two columns beyond that.
    const cols = nums.length > 10 ? 2 : 1;
    const perCol = Math.ceil(nums.length / cols);
    const cap = fitCap(o.paper, perCol, 64);
    const pitch = pitchFor(cap);
    const items: Item[] = [];
    header(items, w);
    const colW = (w - 2 * M - (cols - 1) * COL_GAP) / cols;
    nums.forEach((t, i) => {
      const c = Math.floor(i / perCol), r = i % perCol;
      const x1 = M + c * (colW + COL_GAP);
      drawCell(items, t, x1, x1 + colW, TOP0 + r * pitch, cap, st);
    });
    footer(items, w, h, o.credit);
    return [{ w, h, items }];
  }

  // One number per row, as many pages as the line size needs. Short last pages end with empty lines.
  const cap = ROW_CAP[o.size];
  const per = rowsPerPage(o.paper, cap);
  const pitch = pitchFor(cap);
  const pages: Page[] = [];
  for (let i = 0; i < nums.length; i += per) {
    const items: Item[] = [];
    header(items, w);
    for (let r = 0; r < per; r++) drawCell(items, nums[i + r] ?? '', M, w - M, TOP0 + r * pitch, cap, st);
    footer(items, w, h, o.credit);
    pages.push({ w, h, items });
  }
  return pages;
}

// ---------- Free-text word and sentence sheets ----------

/** Characters the tracing letters can draw: A-Z, a-z, 0-9, spaces and simple punctuation. */
export function cleanTraceText(raw: string): string {
  return raw.replace(/[‘’`]/g, "'").replace(/[^A-Za-z0-9 '.,?!-]/g, '').replace(/\s+/g, ' ').trim();
}

/** Splits text into lines that fit `maxUnits` (in letter-height units), breaking between words. */
export function wrapToWidth(text: string, maxUnits: number): string[] {
  const words = text.split(' ').filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const wd of words) {
    const next = cur ? `${cur} ${wd}` : wd;
    if (!cur || layoutWord(next).width <= maxUnits) cur = next;
    else { out.push(cur); cur = wd; }
  }
  if (cur) out.push(cur);
  return out;
}

export interface WordSheetOptions {
  lines: string[];
  size: LineSize;
  paper: Paper;
  practice: Practice;
  startDots: boolean;
  model: boolean;
  credit: boolean;
}

/**
 * One entry per row. Short words repeat across the row; a long sentence wraps onto as many rows as it needs
 * and shrinks only when a single word is wider than the page. With "trace, then write", a row that is full of
 * tracing is followed by an empty row for writing it on their own.
 */
export function buildWordPages(o: WordSheetOptions): Page[] {
  const { w, h } = PAPER[o.paper];
  const avail = w - 2 * M - 2 * INSET;
  const baseCap = ROW_CAP[o.size];
  type Row = { text: string; cap: number };
  const rows: Row[] = [];
  for (const raw of o.lines) {
    const t = cleanTraceText(raw);
    if (!t) continue;
    for (const part of wrapToWidth(t, avail / baseCap)) {
      const unitsW = layoutWord(part).width;
      const cap = unitsW * baseCap > avail ? avail / unitsW : baseCap;
      rows.push({ text: part, cap });
      const reps = Math.floor((avail + baseCap * 0.9) / (unitsW * cap + baseCap * 0.9));
      if (o.practice === 'trace-write' && reps < 3) rows.push({ text: '', cap });
    }
  }
  if (!rows.length) rows.push({ text: '', cap: baseCap });

  const pages: Page[] = [];
  let items: Item[] = [];
  let y = TOP0;
  const bottom = bottomOf(o.paper);
  const start = () => { items = []; header(items, w); y = TOP0; };
  const finish = () => {
    // Fill the rest of the page with empty handwriting lines.
    while (y + baseCap * 1.5 <= bottom) { drawCell(items, '', M, w - M, y, baseCap, { practice: o.practice, startDots: false, model: false }); y += pitchFor(baseCap); }
    footer(items, w, h, o.credit);
    pages.push({ w, h, items });
  };
  start();
  for (const r of rows) {
    if (y + r.cap * 1.5 > bottom) { finish(); start(); }
    // Blank rows use the page's line size so they match the tracing above.
    drawCell(items, r.text, M, w - M, y, r.cap, { practice: o.practice, startDots: o.startDots, model: o.model });
    y += pitchFor(r.cap);
  }
  finish();
  return pages;
}
