// Cursive practice sheets drawn from the Playwrite US Trad font (OFL), shaped so letters connect.
import { PAPER, COLORS, type Item, type Page, type Paper, type LineSize, type Practice } from './sheet';
import { shape, glyphTop, toPagePath, type LoadedFont } from './fontshape';
import { SITE } from '../config';

export interface CursiveOptions {
  text: string;
  size: LineSize;
  paper: Paper;
  practice: Practice;
  modelRow: boolean;
  credit: boolean;
}

// Distance from baseline to the top writing line, in points.
const CAP: Record<LineSize, number> = { large: 60, medium: 44, small: 30 };

export function cleanCursiveText(raw: string): string {
  return raw.replace(/[^A-Za-z0-9 .,'!?-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

export function buildCursiveSheet(f: LoadedFont, o: CursiveOptions): Page {
  const { w, h } = PAPER[o.paper];
  const m = 40;
  const items: Item[] = [];
  const text = cleanCursiveText(o.text) || 'Hello';

  items.push({ kind: 'text', x: m, y: 56, size: 11, text: 'Name', color: COLORS.ink, align: 'left' });
  items.push({ kind: 'line', x1: m + 36, y1: 58, x2: m + 250, y2: 58, color: COLORS.quiet, width: 0.75 });
  items.push({ kind: 'text', x: w - m - 168, y: 56, size: 11, text: 'Date', color: COLORS.ink, align: 'left' });
  items.push({ kind: 'line', x1: w - m - 136, y1: 58, x2: w - m, y2: 58, color: COLORS.quiet, width: 0.75 });

  const capU = glyphTop(f, 'l') || 1400; // loop letters reach the top line
  const xU = glyphTop(f, 'x') || 600;
  const run = shape(f, text);
  const inset = 14;
  const avail = w - 2 * m - 2 * inset;
  let cap = CAP[o.size];
  let s = cap / capU;
  if (run.width * s > avail) { s = avail / run.width; cap = capU * s; }
  const xh = xU * s;
  const desc = cap * 0.55;

  const oneW = run.width * s;
  const gap = cap * 0.9;
  const reps = Math.max(1, Math.floor((avail + gap) / (oneW + gap)));
  const pitch = cap + desc + Math.max(18, cap * 0.45);
  const top0 = 92;
  const bottom = h - m - 22;
  const rows = Math.max(1, Math.floor((bottom - top0 - cap - desc) / pitch) + 1);

  for (let i = 0; i < rows; i++) {
    const yTop = top0 + i * pitch;
    const yBase = yTop + cap;
    items.push({ kind: 'line', x1: m, y1: yTop, x2: w - m, y2: yTop, color: COLORS.guide, width: 1 });
    items.push({ kind: 'line', x1: m, y1: yBase - xh, x2: w - m, y2: yBase - xh, color: COLORS.mid, width: 0.9, dash: [4, 3] });
    items.push({ kind: 'line', x1: m, y1: yBase, x2: w - m, y2: yBase, color: COLORS.guide, width: 1.2 });
    items.push({ kind: 'line', x1: m, y1: yBase + desc, x2: w - m, y2: yBase + desc, color: COLORS.desc, width: 0.7 });

    const blank = o.practice === 'trace-write' && rows >= 3 && i >= rows - (rows >= 6 ? 2 : 1);
    if (blank) continue;
    const model = o.modelRow && i === 0;
    const totalW = reps * oneW + (reps - 1) * gap;
    const startX = m + inset + (reps === 1 ? 0 : (avail - totalW) / 2);
    for (let r = 0; r < reps; r++) {
      const ox = startX + r * (oneW + gap);
      for (const g of run.glyphs) {
        items.push(
          model
            ? { kind: 'path', d: toPagePath(g, ox, yBase, s), color: COLORS.model, width: 0, fill: COLORS.model }
            : { kind: 'path', d: toPagePath(g, ox, yBase, s), color: '#97a1b5', width: 0.6, fill: '#d6dbe4' },
        );
      }
    }
  }

  if (o.credit) items.push({ kind: 'text', x: w / 2, y: h - m + 14, size: 8, text: `Free printable from ${SITE.domain}`, color: COLORS.quiet, align: 'center' });
  return { w, h, items };
}
