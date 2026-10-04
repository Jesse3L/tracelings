// Ball-and-stick manuscript letters drawn as centerline strokes.
// Units: cap height = 1. Baseline y = 0, midline y = -0.5, top y = -1, descender y = 0.5 (y grows downward).
// Every stroke is a list of absolute commands (M, L, C) so it renders identically in SVG and PDF.

export type Cmd = ['M', number, number] | ['L', number, number] | ['C', number, number, number, number, number, number];
export type Stroke = Cmd[];
export interface Glyph {
  w: number; // advance width (ink width)
  strokes: Stroke[];
  dots?: [number, number][]; // tittles for i and j
}

const rad = (d: number) => (d * Math.PI) / 180;

class S {
  c: Stroke = [];
  private last: [number, number] | null = null;
  m(x: number, y: number) { this.c.push(['M', x, y]); this.last = [x, y]; return this; }
  l(x: number, y: number) {
    if (!this.last) return this.m(x, y);
    this.c.push(['L', x, y]); this.last = [x, y]; return this;
  }
  // Elliptical arc from math angle a1 to a2 (degrees, counterclockwise positive, y-up sense).
  arc(cx: number, cy: number, rx: number, ry: number, a1: number, a2: number) {
    const pt = (a: number): [number, number] => [cx + rx * Math.cos(a), cy - ry * Math.sin(a)];
    const d = (a: number): [number, number] => [-rx * Math.sin(a), -ry * Math.cos(a)];
    const total = a2 - a1;
    const n = Math.max(1, Math.ceil(Math.abs(total) / 90));
    const step = rad(total / n);
    let a = rad(a1);
    const p0 = pt(a);
    if (!this.last) this.m(p0[0], p0[1]);
    else if (Math.hypot(this.last[0] - p0[0], this.last[1] - p0[1]) > 1e-6) this.l(p0[0], p0[1]);
    const k = (4 / 3) * Math.tan(step / 4);
    for (let i = 0; i < n; i++) {
      const b = a + step;
      const P0 = pt(a), P3 = pt(b), D0 = d(a), D3 = d(b);
      this.c.push(['C', P0[0] + k * D0[0], P0[1] + k * D0[1], P3[0] - k * D3[0], P3[1] - k * D3[1], P3[0], P3[1]]);
      this.last = P3;
      a = b;
    }
    return this;
  }
  done() { return this.c; }
}

const line = (x1: number, y1: number, x2: number, y2: number) => new S().m(x1, y1).l(x2, y2).done();
const poly = (...pts: [number, number][]) => { const s = new S(); pts.forEach(([x, y]) => s.l(x, y)); return s.done(); };
const ring = (cx: number, cy: number, rx: number, ry = rx, start = 90) => new S().arc(cx, cy, rx, ry, start, start + 360).done();
const arc = (cx: number, cy: number, rx: number, ry: number, a1: number, a2: number) => new S().arc(cx, cy, rx, ry, a1, a2).done();

const r = 0.25; // lowercase bowl radius (x-height 0.5)
const bowl = (cx: number) => ring(cx, -0.25, r, r, 60);

export const GLYPHS: Record<string, Glyph> = {
  // ---------- lowercase ----------
  a: { w: 0.5, strokes: [bowl(0.25), line(0.5, -0.5, 0.5, 0)] },
  b: { w: 0.5, strokes: [line(0, -1, 0, 0), bowl(0.25)] },
  c: { w: 0.47, strokes: [arc(0.25, -0.25, r, r, 40, 320)] },
  d: { w: 0.5, strokes: [bowl(0.25), line(0.5, -1, 0.5, 0)] },
  e: { w: 0.5, strokes: [new S().m(0.02, -0.25).l(0.5, -0.25).arc(0.25, -0.25, r, r, 0, 320).done()] },
  f: { w: 0.38, strokes: [new S().arc(0.3, -0.85, 0.15, 0.15, 25, 180).l(0.15, 0).done(), line(0, -0.5, 0.34, -0.5)] },
  g: { w: 0.5, strokes: [bowl(0.25), new S().m(0.5, -0.5).l(0.5, 0.35).arc(0.33, 0.35, 0.17, 0.15, 0, -175).done()] },
  h: { w: 0.5, strokes: [line(0, -1, 0, 0), new S().arc(0.25, -0.25, r, r, 180, 0).l(0.5, 0).done()] },
  i: { w: 0.02, strokes: [line(0, -0.5, 0, 0)], dots: [[0, -0.75]] },
  j: { w: 0.25, strokes: [new S().m(0.22, -0.5).l(0.22, 0.35).arc(0.06, 0.35, 0.16, 0.15, 0, -175).done()], dots: [[0.22, -0.75]] },
  k: { w: 0.42, strokes: [line(0, -1, 0, 0), poly([0.4, -0.5], [0, -0.2]), line(0.12, -0.29, 0.42, 0)] },
  l: { w: 0.02, strokes: [line(0, -1, 0, 0)] },
  m: { w: 0.72, strokes: [line(0, -0.5, 0, 0), new S().arc(0.18, -0.32, 0.18, 0.18, 180, 0).l(0.36, 0).done(), new S().arc(0.54, -0.32, 0.18, 0.18, 180, 0).l(0.72, 0).done()] },
  n: { w: 0.5, strokes: [line(0, -0.5, 0, 0), new S().arc(0.25, -0.25, r, r, 180, 0).l(0.5, 0).done()] },
  o: { w: 0.5, strokes: [bowl(0.25)] },
  p: { w: 0.5, strokes: [line(0, -0.5, 0, 0.5), bowl(0.25)] },
  q: { w: 0.55, strokes: [bowl(0.25), new S().m(0.5, -0.5).l(0.5, 0.5).l(0.6, 0.42).done()] },
  r: { w: 0.4, strokes: [line(0, -0.5, 0, 0), new S().arc(0.25, -0.25, r, r, 180, 55).done()] },
  s: { w: 0.42, strokes: [new S().arc(0.21, -0.375, 0.2, 0.125, 30, 270).arc(0.21, -0.125, 0.21, 0.125, 90, -150).done()] },
  t: { w: 0.34, strokes: [line(0.17, -0.88, 0.17, 0), line(0, -0.5, 0.34, -0.5)] },
  u: { w: 0.5, strokes: [new S().m(0, -0.5).l(0, -0.25).arc(0.25, -0.25, r, r, 180, 360).done(), line(0.5, -0.5, 0.5, 0)] },
  v: { w: 0.5, strokes: [poly([0, -0.5], [0.25, 0], [0.5, -0.5])] },
  w: { w: 0.76, strokes: [poly([0, -0.5], [0.19, 0], [0.38, -0.5], [0.57, 0], [0.76, -0.5])] },
  x: { w: 0.46, strokes: [line(0, -0.5, 0.46, 0), line(0.46, -0.5, 0, 0)] },
  y: { w: 0.5, strokes: [line(0, -0.5, 0.25, 0), line(0.5, -0.5, 0.08, 0.5)] },
  z: { w: 0.46, strokes: [poly([0, -0.5], [0.46, -0.5], [0, 0], [0.46, 0])] },

  // ---------- uppercase ----------
  A: { w: 0.72, strokes: [line(0.36, -1, 0, 0), line(0.36, -1, 0.72, 0), line(0.13, -0.36, 0.59, -0.36)] },
  B: { w: 0.56, strokes: [line(0, -1, 0, 0), new S().m(0, -1).l(0.29, -1).arc(0.29, -0.75, 0.25, 0.25, 90, -90).l(0, -0.5).done(), new S().m(0.3, -0.5).arc(0.3, -0.25, 0.26, 0.25, 90, -90).l(0, 0).done()] },
  C: { w: 0.8, strokes: [arc(0.47, -0.5, 0.47, 0.5, 45, 315)] },
  D: { w: 0.7, strokes: [line(0, -1, 0, 0), new S().m(0, -1).l(0.2, -1).arc(0.2, -0.5, 0.5, 0.5, 90, -90).l(0, 0).done()] },
  E: { w: 0.52, strokes: [line(0, -1, 0, 0), line(0, -1, 0.52, -1), line(0, -0.5, 0.42, -0.5), line(0, 0, 0.52, 0)] },
  F: { w: 0.52, strokes: [line(0, -1, 0, 0), line(0, -1, 0.52, -1), line(0, -0.5, 0.42, -0.5)] },
  G: { w: 0.9, strokes: [new S().arc(0.47, -0.5, 0.47, 0.5, 45, 345).l(0.93, -0.42).l(0.58, -0.42).done()] },
  H: { w: 0.62, strokes: [line(0, -1, 0, 0), line(0.62, -1, 0.62, 0), line(0, -0.5, 0.62, -0.5)] },
  I: { w: 0.32, strokes: [line(0.16, -1, 0.16, 0), line(0, -1, 0.32, -1), line(0, 0, 0.32, 0)] },
  J: { w: 0.45, strokes: [new S().m(0.45, -1).l(0.45, -0.25).arc(0.225, -0.25, 0.225, 0.25, 0, -180).done()] },
  K: { w: 0.58, strokes: [line(0, -1, 0, 0), poly([0.56, -1], [0, -0.44]), line(0.2, -0.62, 0.58, 0)] },
  L: { w: 0.5, strokes: [poly([0, -1], [0, 0], [0.5, 0])] },
  M: { w: 0.76, strokes: [line(0, -1, 0, 0), poly([0, -1], [0.38, -0.38], [0.76, -1], [0.76, 0])] },
  N: { w: 0.62, strokes: [line(0, -1, 0, 0), poly([0, -1], [0.62, 0], [0.62, -1])] },
  O: { w: 0.94, strokes: [ring(0.47, -0.5, 0.47, 0.5, 90)] },
  P: { w: 0.55, strokes: [line(0, -1, 0, 0), new S().m(0, -1).l(0.3, -1).arc(0.3, -0.75, 0.25, 0.25, 90, -90).l(0, -0.5).done()] },
  Q: { w: 0.94, strokes: [ring(0.47, -0.5, 0.47, 0.5, 90), line(0.6, -0.28, 0.94, 0.06)] },
  R: { w: 0.58, strokes: [line(0, -1, 0, 0), new S().m(0, -1).l(0.3, -1).arc(0.3, -0.75, 0.25, 0.25, 90, -90).l(0, -0.5).done(), line(0.26, -0.5, 0.58, 0)] },
  S: { w: 0.6, strokes: [new S().arc(0.3, -0.75, 0.28, 0.25, 30, 270).arc(0.3, -0.25, 0.3, 0.25, 90, -150).done()] },
  T: { w: 0.64, strokes: [line(0, -1, 0.64, -1), line(0.32, -1, 0.32, 0)] },
  U: { w: 0.64, strokes: [new S().m(0, -1).l(0, -0.32).arc(0.32, -0.32, 0.32, 0.32, 180, 360).l(0.64, -1).done()] },
  V: { w: 0.66, strokes: [poly([0, -1], [0.33, 0], [0.66, -1])] },
  W: { w: 0.96, strokes: [poly([0, -1], [0.24, 0], [0.48, -1], [0.72, 0], [0.96, -1])] },
  X: { w: 0.62, strokes: [line(0, -1, 0.62, 0), line(0.62, -1, 0, 0)] },
  Y: { w: 0.64, strokes: [line(0, -1, 0.32, -0.5), line(0.64, -1, 0.32, -0.5), line(0.32, -0.5, 0.32, 0)] },
  Z: { w: 0.62, strokes: [poly([0, -1], [0.62, -1], [0, 0], [0.62, 0])] },

  // ---------- digits ----------
  '0': { w: 0.52, strokes: [ring(0.26, -0.5, 0.26, 0.5, 90)] },
  '1': { w: 0.22, strokes: [poly([0, -0.82], [0.2, -1], [0.2, 0])] },
  '2': { w: 0.52, strokes: [new S().arc(0.26, -0.74, 0.25, 0.25, 160, -30).l(0, 0).l(0.52, 0).done()] },
  '3': { w: 0.48, strokes: [new S().arc(0.22, -0.75, 0.24, 0.25, 150, -90).arc(0.22, -0.25, 0.26, 0.25, 90, -150).done()] },
  '4': { w: 0.56, strokes: [poly([0.42, 0], [0.42, -1], [0, -0.34], [0.56, -0.34])] },
  '5': { w: 0.52, strokes: [new S().m(0.48, -1).l(0.06, -1).l(0.02, -0.56).arc(0.24, -0.31, 0.27, 0.27, 125, -140).done()] },
  '6': { w: 0.52, strokes: [new S().m(0.44, -0.98).l(0.3, -0.92).arc(0.6, -0.4, 0.6, 0.6, 120, 180).done(), ring(0.26, -0.26, 0.26, 0.26, 180)] },
  '7': { w: 0.52, strokes: [poly([0, -1], [0.52, -1], [0.14, 0])] },
  '8': { w: 0.5, strokes: [ring(0.25, -0.76, 0.21, 0.24, 270), ring(0.25, -0.26, 0.25, 0.26, 90)] },
  '9': { w: 0.52, strokes: [ring(0.26, -0.74, 0.26, 0.26, 0), line(0.52, -0.74, 0.52, 0)] },
};

export const LETTER_GAP = 0.17;
export const SPACE_W = 0.42;

export const supported = (ch: string) => ch === ' ' || ch in GLYPHS;
