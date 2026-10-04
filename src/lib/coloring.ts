// Name coloring pages: the child's name in big outlined bubble letters, with simple shapes to color around it.
import { PAPER, COLORS, type Item, type Page, type Paper } from './sheet';
import { shape, runBounds, toPagePath, type LoadedFont } from './fontshape';
import { SITE } from '../config';

export type Theme = 'stars' | 'hearts' | 'flowers' | 'bubbles' | 'plain';
export interface ColoringOptions { name: string; theme: Theme; paper: Paper; credit: boolean; caps: boolean }

const INK = '#1e2a44';
const f2 = (n: number) => Math.round(n * 100) / 100;

function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

function star(cx: number, cy: number, r: number, rot: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = rot + (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${f2(cx + rr * Math.cos(a))} ${f2(cy + rr * Math.sin(a))}`);
  }
  return `M${pts.join(' L')} Z`;
}
function heart(cx: number, cy: number, r: number) {
  const t = cy - r * 0.35;
  return `M${f2(cx)} ${f2(cy + r * 0.9)} C${f2(cx - r * 1.3)} ${f2(cy + r * 0.1)} ${f2(cx - r * 0.9)} ${f2(t - r * 0.75)} ${f2(cx)} ${f2(t)} C${f2(cx + r * 0.9)} ${f2(t - r * 0.75)} ${f2(cx + r * 1.3)} ${f2(cy + r * 0.1)} ${f2(cx)} ${f2(cy + r * 0.9)} Z`;
}
function circle(cx: number, cy: number, r: number) {
  const k = 0.5523 * r;
  return `M${f2(cx + r)} ${f2(cy)} C${f2(cx + r)} ${f2(cy + k)} ${f2(cx + k)} ${f2(cy + r)} ${f2(cx)} ${f2(cy + r)} C${f2(cx - k)} ${f2(cy + r)} ${f2(cx - r)} ${f2(cy + k)} ${f2(cx - r)} ${f2(cy)} C${f2(cx - r)} ${f2(cy - k)} ${f2(cx - k)} ${f2(cy - r)} ${f2(cx)} ${f2(cy - r)} C${f2(cx + k)} ${f2(cy - r)} ${f2(cx + r)} ${f2(cy - k)} ${f2(cx + r)} ${f2(cy)} Z`;
}
function flower(cx: number, cy: number, r: number, rot: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = rot + (2 * Math.PI / 5) * i;
    out.push(circle(cx + r * 0.55 * Math.cos(a), cy + r * 0.55 * Math.sin(a), r * 0.42));
  }
  out.push(circle(cx, cy, r * 0.32));
  return out;
}

export function buildColoringPage(f: LoadedFont, o: ColoringOptions): Page {
  const { w, h } = PAPER[o.paper];
  const m = 40;
  const items: Item[] = [];
  const raw = o.name.replace(/[^A-Za-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Name';
  const text = o.caps ? raw.toUpperCase() : raw;

  // One line for short names, two lines (split at a space or the middle) for long ones.
  let lines = [text];
  if (text.length > 7) {
    const sp = text.indexOf(' ');
    lines = sp > 0 ? [text.slice(0, sp), text.slice(sp + 1)] : [text.slice(0, Math.ceil(text.length / 2)), text.slice(Math.ceil(text.length / 2))];
  }
  const runs = lines.map((l) => shape(f, l));
  const bounds = runs.map(runBounds);
  const maxW = Math.max(...bounds.map((b) => b.maxX - b.minX));
  const lineH = Math.max(...bounds.map((b) => b.maxY - b.minY));
  const availW = w - 2 * m - 70;
  const s = Math.min(availW / maxW, 300 / lineH);
  const blockH = lines.length * lineH * s + (lines.length - 1) * lineH * s * 0.2;
  const blockTop = h * 0.42 - blockH / 2;
  const nameBoxes: { x1: number; y1: number; x2: number; y2: number }[] = [];

  runs.forEach((run, i) => {
    const b = bounds[i];
    const lw = (b.maxX - b.minX) * s;
    const ox = (w - lw) / 2 - b.minX * s;
    const base = blockTop + i * lineH * s * 1.2 + b.maxY * s;
    nameBoxes.push({ x1: (w - lw) / 2 - 10, y1: base - b.maxY * s - 10, x2: (w + lw) / 2 + 10, y2: base - b.minY * s + 10 });
    for (const g of run.glyphs) {
      items.push({ kind: 'path', d: toPagePath(g, ox, base, s), color: INK, width: 3, fill: '#ffffff' });
    }
  });

  // Border.
  items.push({ kind: 'path', d: `M${m} ${m} H${w - m} V${h - m - 18} H${m} Z`, color: INK, width: 2.2 });

  if (o.theme !== 'plain') {
    const rand = rng(raw + o.theme);
    const placed: { x: number; y: number; r: number }[] = [];
    const clear = (x: number, y: number, r: number) =>
      x - r > m + 8 && x + r < w - m - 8 && y - r > m + 8 && y + r < h - m - 26 &&
      !nameBoxes.some((bx) => x + r > bx.x1 && x - r < bx.x2 && y + r > bx.y1 && y - r < bx.y2) &&
      placed.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + r + 10);
    for (let tries = 0; tries < 900 && placed.length < 22; tries++) {
      const r = 18 + rand() * 30;
      const x = m + rand() * (w - 2 * m), y = m + rand() * (h - 2 * m);
      if (!clear(x, y, r)) continue;
      placed.push({ x, y, r });
      const rot = rand() * Math.PI;
      const paths = o.theme === 'stars' ? [star(x, y, r, rot)] : o.theme === 'hearts' ? [heart(x, y, r * 0.85)] : o.theme === 'flowers' ? flower(x, y, r, rot) : [circle(x, y, r * 0.8), circle(x + r * 0.3, y - r * 0.3, r * 0.18)];
      for (const d of paths) items.push({ kind: 'path', d, color: INK, width: 2, fill: '#ffffff' });
    }
  }

  if (o.credit) items.push({ kind: 'text', x: w / 2, y: h - m + 6, size: 8, text: `Free printable from ${SITE.domain}`, color: COLORS.quiet, align: 'center' });
  return { w, h, items };
}
