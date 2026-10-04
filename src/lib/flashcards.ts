// Sight word flash cards on the same page model as the worksheets: 8 cards per page (2 across, 4 down),
// dashed cut lines between them, each word drawn large and solid with the ball-and-stick glyph strokes.
import { COLORS, PAPER, glyphFor, layoutWord, strokeToPath, type Item, type Page, type Paper } from './sheet';
import { SITE } from '../config';

export interface FlashCardOptions {
  words: string[];
  paper: Paper;
  /** Small level label printed in the corner of each card, e.g. "Kindergarten". */
  label?: string;
  credit?: boolean;
}

export const CARDS_PER_PAGE = 8;
const COLS = 2;
const ROWS = 4;

export function buildFlashCards(o: FlashCardOptions): Page[] {
  const { w, h } = PAPER[o.paper];
  const m = 30;
  const footer = o.credit === false ? 0 : 14;
  const cardW = (w - 2 * m) / COLS;
  const cardH = (h - 2 * m - footer) / ROWS;
  const pad = 24;
  const maxCap = cardH * 0.5; // ascender to descender is 1.5 cap, so words never touch the card edge
  const cut = { color: COLORS.quiet, width: 0.75, dash: [5, 4] };
  const pages: Page[] = [];

  for (let start = 0; start < Math.max(1, o.words.length); start += CARDS_PER_PAGE) {
    const words = o.words.slice(start, start + CARDS_PER_PAGE);
    const items: Item[] = [];

    // Cut lines: the outer border plus the grid between cards.
    for (let c = 0; c <= COLS; c++) {
      const x = m + c * cardW;
      items.push({ kind: 'line', x1: x, y1: m, x2: x, y2: m + ROWS * cardH, ...cut });
    }
    for (let r = 0; r <= ROWS; r++) {
      const y = m + r * cardH;
      items.push({ kind: 'line', x1: m, y1: y, x2: m + COLS * cardW, y2: y, ...cut });
    }

    // One letter size per page, set by the widest word, so the cards look like a set.
    const cap = Math.min(maxCap, ...words.map((wd) => (cardW - 2 * pad) / Math.max(layoutWord(wd).width, 0.1)));

    words.forEach((word, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      const x0 = m + col * cardW, y0 = m + row * cardH;
      const lay = layoutWord(word);
      const hasAsc = [...word].some((ch) => /[A-Zbdfhklt0-9'’ij]/.test(ch));
      const hasDesc = [...word].some((ch) => 'gjpqy'.includes(ch));
      // Center each word on its actual ink (ascenders and descenders), not on the baseline.
      const top = hasAsc ? -1 : -0.5;
      const bot = hasDesc ? 0.5 : 0;
      const ox0 = x0 + (cardW - lay.width * cap) / 2;
      const base = y0 + cardH / 2 - ((top + bot) / 2) * cap;
      const sw = Math.max(2.5, cap * 0.07);

      for (const p of lay.placed) {
        const g = glyphFor(p.ch)!;
        const ox = ox0 + p.x * cap;
        for (const s of g.strokes) items.push({ kind: 'path', d: strokeToPath(s, ox, base, cap), color: COLORS.model, width: sw });
        for (const [dx, dy] of g.dots ?? []) items.push({ kind: 'dot', cx: ox + dx * cap, cy: base + dy * cap, r: sw * 0.95, color: COLORS.model });
      }
      if (o.label) items.push({ kind: 'text', x: x0 + cardW - 10, y: y0 + cardH - 9, size: 7.5, text: o.label, color: COLORS.quiet, align: 'right' });
    });

    if (o.credit !== false) {
      items.push({ kind: 'text', x: w / 2, y: h - m + 6, size: 8, text: `Free printable from ${SITE.domain}`, color: COLORS.quiet, align: 'center' });
    }
    pages.push({ w, h, items });
  }
  return pages;
}
