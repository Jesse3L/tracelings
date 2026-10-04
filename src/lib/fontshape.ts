// Font-based lettering (cursive and bubble letters), shaped with HarfBuzz so cursive letters join correctly.
// Fonts are open-licensed and served from /fonts/. Everything runs in the browser.
type HB = typeof import('harfbuzzjs');
type HBFont = InstanceType<HB['Font']>;

let hbPromise: Promise<HB> | null = null;
const cache = new Map<string, Promise<HBFont>>();

export const FONTS = {
  cursive: '/fonts/playwrite-us-trad.ttf',
  bubble: '/fonts/luckiest-guy.ttf',
  rounded: '/fonts/fredoka.ttf',
} as const;
export type FontKey = keyof typeof FONTS;

export interface LoadedFont { hb: HB; font: HBFont; key: FontKey }

export async function loadFont(key: FontKey, fetcher: (url: string) => Promise<ArrayBuffer> = (u) => fetch(u).then((r) => r.arrayBuffer())): Promise<LoadedFont> {
  hbPromise ??= import('harfbuzzjs');
  const hb = await hbPromise;
  if (!cache.has(key)) cache.set(key, fetcher(FONTS[key]).then((buf) => new hb.Font(new hb.Face(new hb.Blob(buf)))));
  return { hb, font: await cache.get(key)!, key };
}

export interface ShapedRun {
  glyphs: { d: string; x: number; y: number }[]; // outline in font units (y up), with pen offset
  width: number; // font units
}

export function shape(f: LoadedFont, text: string): ShapedRun {
  const buf = new f.hb.Buffer();
  buf.addText(text);
  buf.guessSegmentProperties();
  f.hb.shape(f.font, buf);
  const infos = buf.getGlyphInfos();
  const pos = buf.getGlyphPositions();
  let x = 0;
  const glyphs: ShapedRun['glyphs'] = [];
  infos.forEach((g, i) => {
    const d = f.font.glyphToPath(g.codepoint);
    if (d) glyphs.push({ d, x: x + pos[i].xOffset, y: pos[i].yOffset });
    x += pos[i].xAdvance;
  });
  return { glyphs, width: x };
}

/** Top of a glyph above the baseline, in font units (e.g. x-height from "x", cap height from "H"). */
export function glyphTop(f: LoadedFont, ch: string): number {
  const buf = new f.hb.Buffer();
  buf.addText(ch);
  buf.guessSegmentProperties();
  f.hb.shape(f.font, buf);
  const gid = buf.getGlyphInfos()[0]?.codepoint;
  const ext = gid != null ? f.font.glyphExtents(gid) : undefined;
  return ext ? ext.yBearing : 0;
}

/** Bounding box of a run in font units (y up). */
export function runBounds(run: ShapedRun) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const g of run.glyphs) {
    const nums = g.d.match(/-?\d*\.?\d+(?:e-?\d+)?/g)?.map(Number) ?? [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = nums[i] + g.x, y = nums[i + 1] + g.y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return { minX, maxX, minY, maxY };
}

/** Map a font-unit outline to page points: origin (ox, baseline), scale s, y flipped. */
export function toPagePath(g: { d: string; x: number; y: number }, ox: number, base: number, s: number): string {
  const r = (n: number) => Math.round(n * 100) / 100;
  return g.d.replace(/([MLQCZ])([^MLQCZ]*)/g, (_, cmd: string, args: string) => {
    if (cmd === 'Z') return 'Z';
    const n = args.match(/-?\d*\.?\d+(?:e-?\d+)?/g)?.map(Number) ?? [];
    const out: number[] = [];
    for (let i = 0; i + 1 < n.length; i += 2) out.push(r(ox + (n[i] + g.x) * s), r(base - (n[i + 1] + g.y) * s));
    return cmd + out.join(' ');
  });
}
