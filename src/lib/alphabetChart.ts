// Printable alphabet charts: ball-and-stick print letters or Playwrite cursive, A to Z in a grid.
// The same Page model feeds the on-screen preview, the build-time chart image and the PDF.
import { PAPER, COLORS, glyphFor, strokeToPath, type Item, type Page, type Paper } from './sheet';
import { shape, glyphTop, runBounds, toPagePath, type LoadedFont } from './fontshape';
import { SITE } from '../config';

export type ChartLetters = 'pairs' | 'upper' | 'lower';

export interface ChartOptions {
  paper: Paper;
  letters: ChartLetters;
  credit: boolean;
  /** Print charts only: green dots where each stroke starts. */
  startDots?: boolean;
  /** Leave out the page title (used for the on-page chart image, which has its own heading). */
  noTitle?: boolean;
}

const ABC = 'abcdefghijklmnopqrstuvwxyz'.split('');
const M = 36;
const COLS = 4;
const ROWS = 7;

interface Cell { x: number; y: number; w: number; h: number }

function frame(o: ChartOptions, title: string): { w: number; h: number; items: Item[]; cells: Cell[] } {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  const top = o.noTitle ? M : 84;
  if (!o.noTitle) items.push({ kind: 'text', x: w / 2, y: 58, size: 22, text: title, color: COLORS.ink, align: 'center' });
  const bottom = h - M - (o.credit ? 14 : 0);
  const gap = 8;
  const cw = (w - 2 * M - (COLS - 1) * gap) / COLS;
  const ch = (bottom - top - (ROWS - 1) * gap) / ROWS;
  const cells: Cell[] = [];
  ABC.forEach((_, i) => {
    let r = Math.floor(i / COLS), c = i % COLS;
    // The last row holds two letters; center them.
    const inLast = r === ROWS - 1;
    const x = M + (inLast ? (cw + gap) * (c + 1) : c * (cw + gap));
    cells.push({ x, y: top + r * (ch + gap), w: cw, h: ch });
  });
  for (const c of cells) {
    const r = 10;
    items.push({
      kind: 'path',
      d: `M${c.x + r} ${c.y} L${c.x + c.w - r} ${c.y} Q${c.x + c.w} ${c.y} ${c.x + c.w} ${c.y + r} L${c.x + c.w} ${c.y + c.h - r} Q${c.x + c.w} ${c.y + c.h} ${c.x + c.w - r} ${c.y + c.h} L${c.x + r} ${c.y + c.h} Q${c.x} ${c.y + c.h} ${c.x} ${c.y + c.h - r} L${c.x} ${c.y + r} Q${c.x} ${c.y} ${c.x + r} ${c.y} Z`,
      color: '#c9d3e6', width: 1.1,
    });
  }
  if (o.credit) items.push({ kind: 'text', x: w / 2, y: h - M + 8, size: 8, text: `Free printable from ${SITE.domain}`, color: COLORS.quiet, align: 'center' });
  return { w, h, items, cells };
}

function cellGuides(items: Item[], c: Cell, yTop: number, yMid: number, yBase: number) {
  const x1 = c.x + 8, x2 = c.x + c.w - 8;
  items.push({ kind: 'line', x1, y1: yTop, x2, y2: yTop, color: COLORS.guide, width: 0.7 });
  items.push({ kind: 'line', x1, y1: yMid, x2, y2: yMid, color: COLORS.mid, width: 0.6, dash: [3, 2.5] });
  items.push({ kind: 'line', x1, y1: yBase, x2, y2: yBase, color: COLORS.guide, width: 0.9 });
}

const textsFor = (l: string, letters: ChartLetters) => (letters === 'upper' ? [l.toUpperCase()] : letters === 'lower' ? [l] : [l.toUpperCase(), l]);

export function buildPrintChart(o: ChartOptions): Page {
  const { w, h, items, cells } = frame(o, 'Alphabet Chart');
  const c0 = cells[0];
  // Letter height so the widest pair (Mm, Ww) fits and descenders stay inside the cell.
  const widest = Math.max(...ABC.map((l) => textsFor(l, o.letters).reduce((s, t) => s + glyphFor(t)!.w, 0) + (o.letters === 'pairs' ? 0.42 : 0)));
  const cap = Math.min((c0.w - 28) / widest, (c0.h - 20) / 1.5);
  ABC.forEach((l, i) => {
    const c = cells[i];
    const yTop = c.y + (c.h - cap * 1.5) / 2 + 2;
    const yBase = yTop + cap;
    cellGuides(items, c, yTop, yTop + cap * 0.5, yBase);
    const ts = textsFor(l, o.letters);
    const totalW = ts.reduce((s, t) => s + glyphFor(t)!.w * cap, 0) + (ts.length - 1) * 0.42 * cap;
    let x = c.x + (c.w - totalW) / 2;
    const sw = Math.max(2, cap * 0.075);
    for (const t of ts) {
      const g = glyphFor(t)!;
      for (const s of g.strokes) items.push({ kind: 'path', d: strokeToPath(s, x, yBase, cap), color: COLORS.model, width: sw });
      for (const [dx, dy] of g.dots ?? []) items.push({ kind: 'dot', cx: x + dx * cap, cy: yBase + dy * cap, r: sw * 0.9, color: COLORS.model });
      if (o.startDots) for (const s of g.strokes) items.push({ kind: 'dot', cx: x + s[0][1] * cap, cy: yBase + s[0][2] * cap, r: Math.max(2, cap * 0.055), color: COLORS.start });
      x += g.w * cap + 0.42 * cap;
    }
  });
  return { w, h, items };
}

export function buildCursiveChart(f: LoadedFont, o: ChartOptions): Page {
  const { w, h, items, cells } = frame(o, 'Cursive Alphabet');
  const c0 = cells[0];
  const capU = glyphTop(f, 'l') || 1400;
  const xU = glyphTop(f, 'x') || 600;
  const runs = ABC.map((l) => textsFor(l, o.letters).map((t) => { const run = shape(f, t); return { run, b: runBounds(run) }; }));
  const gapU = capU * 0.35;
  // One scale for the whole chart so every letter sits on the same lines.
  let minY = 0, maxW = 0, maxY = capU;
  for (const rs of runs) {
    const wU = rs.reduce((s, r) => s + (r.b.maxX - Math.min(0, r.b.minX)), 0) + (rs.length - 1) * gapU;
    maxW = Math.max(maxW, wU);
    for (const r of rs) { minY = Math.min(minY, r.b.minY); maxY = Math.max(maxY, r.b.maxY); }
  }
  const s = Math.min((c0.w - 24) / maxW, (c0.h - 16) / (maxY - minY));
  ABC.forEach((_, i) => {
    const c = cells[i];
    const rs = runs[i];
    // Baseline placed so the tallest ascender and deepest descender in the chart both fit.
    const yBase = c.y + 8 + maxY * s + ((c.h - 16) - (maxY - minY) * s) / 2;
    cellGuides(items, c, yBase - capU * s, yBase - xU * s, yBase);
    const wU = rs.reduce((acc, r) => acc + (r.b.maxX - Math.min(0, r.b.minX)), 0) + (rs.length - 1) * gapU;
    let x = c.x + (c.w - wU * s) / 2;
    for (const r of rs) {
      const ox = x - Math.min(0, r.b.minX) * s;
      for (const g of r.run.glyphs) items.push({ kind: 'path', d: toPagePath(g, ox, yBase, s), color: COLORS.model, width: 0, fill: COLORS.model });
      x += (r.b.maxX - Math.min(0, r.b.minX) + gapU) * s;
    }
  });
  return { w, h, items };
}

/** A single cursive letter pair, large, for the per-letter pages. Returns an SVG string. */
export function cursivePairSvg(f: LoadedFont, letter: string, label: string): string {
  const capU = glyphTop(f, 'l') || 1400;
  const xU = glyphTop(f, 'x') || 600;
  const parts = [letter.toUpperCase(), letter.toLowerCase()].map((t) => { const run = shape(f, t); return { run, b: runBounds(run) }; });
  const s = 150 / capU;
  const gap = 70;
  const pad = 30;
  const minY = Math.min(...parts.map((p) => p.b.minY), -capU * 0.55);
  const maxY = Math.max(...parts.map((p) => p.b.maxY), capU);
  const widths = parts.map((p) => (p.b.maxX - Math.min(0, p.b.minX)) * s);
  const W = Math.round(widths[0] + widths[1] + gap + 2 * pad + 40);
  const H = Math.round((maxY - minY) * s + 2 * pad);
  const yBase = pad + maxY * s;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${label}">`,
    `<title>${label}</title>`,
    `<rect width="${W}" height="${H}" fill="#ffffff"/>`,
    `<line x1="10" y1="${yBase - capU * s}" x2="${W - 10}" y2="${yBase - capU * s}" stroke="${COLORS.guide}" stroke-width="1.5"/>`,
    `<line x1="10" y1="${yBase - xU * s}" x2="${W - 10}" y2="${yBase - xU * s}" stroke="${COLORS.mid}" stroke-width="1.3" stroke-dasharray="7 5"/>`,
    `<line x1="10" y1="${yBase}" x2="${W - 10}" y2="${yBase}" stroke="${COLORS.guide}" stroke-width="2"/>`,
  ];
  let x = pad + 20;
  parts.forEach((p, i) => {
    const ox = x - Math.min(0, p.b.minX) * s;
    for (const g of p.run.glyphs) out.push(`<path d="${toPagePath(g, ox, yBase, s)}" fill="${COLORS.model}"/>`);
    x += widths[i] + gap;
  });
  out.push('</svg>');
  return out.join('');
}
