// The personalized storybook as a printable picture book: one story page per sheet (portrait), with the child's
// name on the cover, in the story and on the last page. Pictures are line art, so the book doubles as a coloring
// book. Pure page model (sheet.ts Page), so the same pages render to PDF in the browser and to PNG in scripts.
// The child's name never leaves the browser: the server sends the story with {{name}} and the page fills it in.
import { PAPER, COLORS, styleName, type Item, type Page, type Paper } from '../sheet';
import { SITE } from '../../config';

const INK = COLORS.ink;

export interface GiftBook {
  title: string;
  /** "A Christmas story", "A dinosaur story". */
  kind: string;
  /** Picture URL and size for the cover and each page. */
  cover: { src: string; w: number; h: number };
  pages: { src: string; w: number; h: number; text: string }[];
}

export interface GiftOptions { name: string; from?: string; paper?: Paper }

const textW = (t: string, size: number) => {
  let u = 0;
  for (const ch of t) u += /[il.,'!|:;]/.test(ch) ? 0.26 : /[mwMW]/.test(ch) ? 0.84 : /[A-Z]/.test(ch) ? 0.66 : ch === ' ' ? 0.28 : 0.53;
  return u * size;
};
function wrap(t: string, size: number, maxW: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of t.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && textW(next, size) > maxW) { out.push(cur); cur = word; } else cur = next;
  }
  if (cur) out.push(cur);
  // A single word wider than the line (a very long name) is split so nothing runs off the page.
  return out.flatMap((line) => {
    const parts: string[] = [];
    let rest = line;
    while (textW(rest, size) > maxW && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && textW(`${rest.slice(0, cut)}-`, size) > maxW) cut--;
      parts.push(`${rest.slice(0, cut)}-`);
      rest = rest.slice(cut);
    }
    parts.push(rest);
    return parts;
  });
}
function fit(text: string, start: number, min: number, maxW: number, maxH: number, lead: number): { size: number; lines: string[] } {
  for (let size = start; size >= min; size -= 0.5) {
    const lines = wrap(text, size, maxW);
    if (lines.length * size * lead <= maxH) return { size, lines };
  }
  return { size: min, lines: wrap(text, min, maxW) };
}
const box = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;

/** The child's name as typed, tidied (capitalized, accents kept out for the PDF font), or a gentle fallback. */
export const bookName = (raw: string) => styleName(raw, 'capital') || 'Little One';

/** Swaps {{name}} for the child's name. */
export const fillName = (text: string, name: string) => {
  const who = bookName(name);
  return text.replace(/\{\{name\}\}/g, who);
};

export function giftBookPages(book: GiftBook, o: GiftOptions): Page[] {
  const { w, h } = PAPER[o.paper ?? 'letter'];
  const M = 42;
  const who = bookName(o.name);
  const from = styleName(o.from ?? '', 'capital');
  const out: Page[] = [];
  const center = (items: Item[], lines: string[], y: number, size: number, color = INK, lead = 1.3) => {
    for (const l of lines) { items.push({ kind: 'text', x: w / 2, y, size, text: l, color, align: 'center' }); y += size * lead; }
    return y;
  };
  const picture = (items: Item[], p: { src: string; w: number; h: number }, y: number, maxW: number, maxH: number) => {
    const k = Math.min(maxW / p.w, maxH / p.h);
    const iw = p.w * k, ih = p.h * k, ix = (w - iw) / 2;
    items.push({ kind: 'image', x: ix, y, w: iw, h: ih, src: p.src });
    items.push({ kind: 'path', d: box(ix - 4, y - 4, iw + 8, ih + 8, 10), color: COLORS.desc, width: 1.4 });
    return ih;
  };

  // Cover
  {
    const items: Item[] = [];
    items.push({ kind: 'path', d: box(18, 18, w - 36, h - 36, 16), color: INK, width: 2 });
    items.push({ kind: 'path', d: box(26, 26, w - 52, h - 52, 12), color: COLORS.desc, width: 1 });
    const t = fit(book.title, 46, 26, w - 2 * M - 20, 110, 1.12);
    let y = center(items, t.lines, 100, t.size, INK, 1.12);
    const ih = picture(items, book.cover, y + 8, w - 2 * M - 20, h - y - 250);
    y += ih + 70;
    const s = fit(`${book.kind} starring ${who}`, 32, 16, w - 2 * M - 20, 90, 1.25);
    y = center(items, s.lines, y, s.size, INK, 1.25);
    if (from) {
      const f = fit(`Made with love for ${who}, from ${from}`, 17, 11, w - 2 * M - 20, 46, 1.3);
      center(items, f.lines, y + 16, f.size, COLORS.quiet);
    }
    out.push({ w, h, items });
  }

  // Story pages
  book.pages.forEach((p, i) => {
    const items: Item[] = [];
    const ih = picture(items, p, M + 10, w - 2 * M, (h - 2 * M) * 0.58);
    const top = M + 10 + ih + 30;
    const avail = h - M - 34 - top;
    const t = fit(fillName(p.text, o.name), 38, 18, w - 2 * M - 16, avail, 1.3);
    const blockH = t.lines.length * t.size * 1.3;
    center(items, t.lines, top + Math.max(0, (avail - blockH) / 2) + t.size * 0.9, t.size, INK, 1.3);
    items.push({ kind: 'text', x: w / 2, y: h - M + 6, size: 11, text: String(i + 1), color: COLORS.quiet, align: 'center' });
    out.push({ w, h, items });
  });

  // The end
  {
    const items: Item[] = [];
    let y = center(items, ['The end'], 150, 48);
    const wr = fit(`Well read, ${who}!`, 26, 14, w - 2 * M, 70, 1.25);
    y = center(items, wr.lines, y + 20, wr.size);
    const bw = w - 2 * M - 40, bh = 300;
    items.push({ kind: 'path', d: box((w - bw) / 2, y + 20, bw, bh, 14), color: COLORS.quiet, width: 1.2, dash: [5, 4] });
    center(items, ['Draw your favorite part of the story.'], y + 46, 14, COLORS.quiet);
    y += bh + 70;
    center(items, ['Color the pictures, then read it again tomorrow.'], y, 13, COLORS.quiet);
    center(items, [`Made for ${who} at ${SITE.domain}`], h - M, 10, COLORS.quiet);
    out.push({ w, h, items });
  }
  return out;
}
