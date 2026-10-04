// One page model drives both the on-screen preview (SVG) and the PDF, so they always match.
// All coordinates are PDF points with the origin at the top-left of the page (y grows downward).
import { GLYPHS, LETTER_GAP, SPACE_W, type Stroke } from './glyphs';
import { SITE } from '../config';

export type LetterStyle = 'capital' | 'caps' | 'lower';
export type LineSize = 'large' | 'medium' | 'small';
export type Paper = 'letter' | 'a4';
export type Practice = 'trace' | 'trace-write';

export interface SheetOptions {
  name: string;
  style: LetterStyle;
  size: LineSize;
  paper: Paper;
  practice: Practice;
  startDots: boolean;
  modelRow: boolean;
  credit: boolean;
}

export type Item =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number; dash?: number[] }
  | { kind: 'path'; d: string; color: string; width: number; dash?: number[] }
  | { kind: 'dot'; cx: number; cy: number; r: number; color: string }
  | { kind: 'text'; x: number; y: number; size: number; text: string; color: string; align: 'left' | 'center' | 'right' };

export interface Page { w: number; h: number; items: Item[] }

export const PAPER: Record<Paper, { w: number; h: number }> = {
  letter: { w: 612, h: 792 },
  a4: { w: 595.28, h: 841.89 },
};

const CAP: Record<LineSize, number> = { large: 64, medium: 46, small: 32 };

export const COLORS = {
  guide: '#5b86d9',
  mid: '#e46a72',
  desc: '#c9d6f0',
  model: '#34405a',
  trace: '#9ba4b8',
  start: '#2f9e6b',
  ink: '#34405a',
  quiet: '#8a93a6',
};

export function styleName(raw: string, style: LetterStyle): string {
  const clean = raw.replace(/[^A-Za-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  if (style === 'caps') return clean.toUpperCase();
  if (style === 'lower') return clean.toLowerCase();
  return clean
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

interface Placed { ch: string; x: number }

function layoutWord(text: string): { placed: Placed[]; width: number } {
  const placed: Placed[] = [];
  let x = 0;
  for (const ch of text) {
    if (ch === ' ') { x += SPACE_W; continue; }
    const g = GLYPHS[ch];
    if (!g) continue;
    placed.push({ ch, x });
    x += g.w + LETTER_GAP;
  }
  return { placed, width: Math.max(0, x - LETTER_GAP) };
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();

function strokeToPath(s: Stroke, ox: number, base: number, cap: number): string {
  return s
    .map((c) => {
      if (c[0] === 'M' || c[0] === 'L') return `${c[0]}${f(ox + c[1] * cap)} ${f(base + c[2] * cap)}`;
      return `C${f(ox + c[1] * cap)} ${f(base + c[2] * cap)} ${f(ox + c[3] * cap)} ${f(base + c[4] * cap)} ${f(ox + c[5] * cap)} ${f(base + c[6] * cap)}`;
    })
    .join(' ');
}

type RowKind = 'model' | 'trace' | 'blank';

export function buildSheet(o: SheetOptions): Page {
  const { w, h } = PAPER[o.paper];
  const m = 40;
  const items: Item[] = [];
  const text = styleName(o.name, o.style) || (o.style === 'caps' ? 'NAME' : o.style === 'lower' ? 'name' : 'Name');
  const { placed, width: unitsW } = layoutWord(text);

  // Header: name and date lines for the child's work.
  items.push({ kind: 'text', x: m, y: 56, size: 11, text: 'Name', color: COLORS.ink, align: 'left' });
  items.push({ kind: 'line', x1: m + 36, y1: 58, x2: m + 250, y2: 58, color: COLORS.quiet, width: 0.75 });
  items.push({ kind: 'text', x: w - m - 168, y: 56, size: 11, text: 'Date', color: COLORS.ink, align: 'left' });
  items.push({ kind: 'line', x1: w - m - 136, y1: 58, x2: w - m, y2: 58, color: COLORS.quiet, width: 0.75 });

  const inset = 14;
  const avail = w - 2 * m - 2 * inset;
  let cap = CAP[o.size];
  if (unitsW * cap > avail) cap = avail / unitsW; // long names shrink to fit one row

  // Short names repeat across the row for more practice.
  const repeatGap = 0.9 * cap;
  const oneW = unitsW * cap;
  const reps = Math.max(1, Math.floor((avail + repeatGap) / (oneW + repeatGap)));

  const pitch = cap * 1.5 + Math.max(16, cap * 0.42);
  const top0 = 92;
  const bottom = h - m - 22;
  const rowCount = Math.max(1, Math.floor((bottom - top0 - cap * 1.5) / pitch) + 1);

  const kinds: RowKind[] = [];
  for (let i = 0; i < rowCount; i++) kinds.push('trace');
  if (o.modelRow) kinds[0] = 'model';
  if (o.practice === 'trace-write' && rowCount >= 3) {
    const blanks = rowCount >= 6 ? 2 : 1;
    for (let i = rowCount - blanks; i < rowCount; i++) kinds[i] = 'blank';
  }

  const strokeW = { model: Math.max(2, cap * 0.055), trace: Math.max(1.4, cap * 0.042) };
  const dash = [Math.max(2.2, cap * 0.075), Math.max(1.8, cap * 0.06)];

  kinds.forEach((kind, i) => {
    const yTop = top0 + i * pitch;
    const yMid = yTop + cap * 0.5;
    const yBase = yTop + cap;
    const yDesc = yTop + cap * 1.5;
    const x1 = m, x2 = w - m;
    items.push({ kind: 'line', x1, y1: yTop, x2, y2: yTop, color: COLORS.guide, width: 1 });
    items.push({ kind: 'line', x1, y1: yMid, x2, y2: yMid, color: COLORS.mid, width: 0.9, dash: [4, 3] });
    items.push({ kind: 'line', x1, y1: yBase, x2, y2: yBase, color: COLORS.guide, width: 1.2 });
    items.push({ kind: 'line', x1, y1: yDesc, x2, y2: yDesc, color: COLORS.desc, width: 0.7 });
    if (kind === 'blank') return;

    const color = kind === 'model' ? COLORS.model : COLORS.trace;
    const sw = kind === 'model' ? strokeW.model : strokeW.trace;
    const d = kind === 'trace' ? dash : undefined;
    const totalW = reps * oneW + (reps - 1) * repeatGap;
    const startX = m + inset + (reps === 1 ? 0 : (avail - totalW) / 2);

    for (let r = 0; r < reps; r++) {
      const ox0 = startX + r * (oneW + repeatGap);
      for (const p of placed) {
        const g = GLYPHS[p.ch];
        const ox = ox0 + p.x * cap;
        for (const s of g.strokes) {
          items.push({ kind: 'path', d: strokeToPath(s, ox, yBase, cap), color, width: sw, dash: d });
        }
        for (const [dx, dy] of g.dots ?? []) {
          items.push({ kind: 'dot', cx: ox + dx * cap, cy: yBase + dy * cap, r: sw * 0.95, color });
        }
        if (kind === 'trace' && o.startDots) {
          for (const s of g.strokes) {
            const c0 = s[0];
            items.push({ kind: 'dot', cx: ox + c0[1] * cap, cy: yBase + c0[2] * cap, r: Math.max(1.9, cap * 0.045), color: COLORS.start });
          }
        }
      }
    }
  });

  if (o.credit) {
    items.push({ kind: 'text', x: w / 2, y: h - m + 14, size: 8, text: `Free printable from ${SITE.domain}`, color: COLORS.quiet, align: 'center' });
  }
  return { w, h, items };
}
