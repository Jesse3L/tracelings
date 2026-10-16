import type { Page } from './sheet';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;');

// ---------- Raster pictures (story scenes) ----------
// Pages only hold a picture's URL. The PDF needs the bytes, so load them first with loadImages (the browser
// fetches /program/scenes/...; scripts pass a fetcher that reads public/ from disk). A picture that did not load
// prints as a light frame, so a missing file never stops a PDF.

const imageBytes = new Map<string, Uint8Array>();
const imagePending = new Map<string, Promise<void>>();
export type ImageFetcher = (url: string) => Promise<ArrayBuffer | Uint8Array>;
const fetchImage: ImageFetcher = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); });

/** Loads picture bytes for the PDF. Resolves to the URLs that loaded; failures are skipped. */
export async function loadImages(urls: string[], fetcher: ImageFetcher = fetchImage): Promise<string[]> {
  await Promise.all([...new Set(urls)].map((u) => {
    if (imageBytes.has(u)) return Promise.resolve();
    if (!imagePending.has(u)) {
      imagePending.set(u, fetcher(u)
        .then((b) => { imageBytes.set(u, b instanceof Uint8Array ? b : new Uint8Array(b)); })
        .catch(() => undefined)
        .finally(() => { imagePending.delete(u); }));
    }
    return imagePending.get(u)!;
  }));
  return urls.filter((u) => imageBytes.has(u));
}
export const imageLoaded = (u: string) => imageBytes.has(u);
/** The picture URLs a set of pages uses. */
export const imagesIn = (pages: Page[]) => [...new Set(pages.flatMap((p) => p.items.flatMap((it) => (it.kind === 'image' ? [it.src] : []))))];

/** How image sources are written into the SVG. Scripts that rasterize the SVG set a data: URI mapper; the site
 *  leaves the URL as is. (Not a pageToSvg parameter, so pages.map(pageToSvg) keeps working.) */
let svgHref: (src: string) => string = (s) => s;
export function setSvgImageHref(f: ((src: string) => string) | null) { svgHref = f ?? ((s) => s); }

export function pageToSvg(p: Page): string {
  const href = svgHref;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.w} ${p.h}" width="100%" role="img" aria-label="Worksheet preview">`,
    `<rect width="${p.w}" height="${p.h}" fill="#ffffff"/>`,
  ];
  for (const it of p.items) {
    if (it.kind === 'line') {
      out.push(`<line x1="${it.x1}" y1="${it.y1}" x2="${it.x2}" y2="${it.y2}" stroke="${it.color}" stroke-width="${it.width}"${it.dash ? ` stroke-dasharray="${it.dash.join(' ')}"` : ''}/>`);
    } else if (it.kind === 'path') {
      const stroke = it.width > 0 ? ` stroke="${it.color}" stroke-width="${it.width}" stroke-linecap="round" stroke-linejoin="round"${it.dash ? ` stroke-dasharray="${it.dash.join(' ')}"` : ''}` : '';
      out.push(`<path d="${it.d}" fill="${it.fill ?? 'none'}"${it.evenOdd ? ' fill-rule="evenodd"' : ''}${stroke}/>`);
    } else if (it.kind === 'dot') {
      out.push(`<circle cx="${it.cx}" cy="${it.cy}" r="${it.r}" fill="${it.color}"/>`);
    } else if (it.kind === 'image') {
      out.push(`<image href="${escAttr(href(it.src))}" x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" preserveAspectRatio="xMidYMid meet"/>`);
    } else {
      const anchor = it.align === 'center' ? 'middle' : it.align === 'right' ? 'end' : 'start';
      const rot = it.rotate ? ` transform="rotate(${it.rotate} ${it.x} ${it.y})"` : '';
      out.push(`<text x="${it.x}" y="${it.y}" font-size="${it.size}" fill="${it.color}" text-anchor="${anchor}"${rot} font-family="Helvetica, Arial, sans-serif">${esc(it.text)}</text>`);
    }
  }
  out.push('</svg>');
  return out.join('');
}

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] as const;
};

export async function pagesToPdf(pages: Page[], title = 'Name tracing worksheet'): Promise<Uint8Array> {
  const { PDFDocument, rgb, StandardFonts, LineCapStyle, FillRule, degrees } = await import('@cantoo/pdf-lib');
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setCreator('Tracelings');
  doc.setProducer('Tracelings');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const c = (h: string) => rgb(...hex(h));
  // Each picture is embedded once per PDF, at its own full resolution, however many pages use it.
  type Embedded = Awaited<ReturnType<typeof doc.embedPng>>;
  const embedded = new Map<string, Embedded | null>();
  const embed = async (src: string): Promise<Embedded | null> => {
    if (!embedded.has(src)) {
      const b = imageBytes.get(src);
      let img: Embedded | null = null;
      if (b) {
        try { img = b[0] === 0xff && b[1] === 0xd8 ? await doc.embedJpg(b) : await doc.embedPng(b); } catch { img = null; }
      }
      embedded.set(src, img);
    }
    return embedded.get(src)!;
  };

  for (const p of pages) {
    const page = doc.addPage([p.w, p.h]);
    const Y = (y: number) => p.h - y;
    for (const it of p.items) {
      if (it.kind === 'line') {
        page.drawLine({ start: { x: it.x1, y: Y(it.y1) }, end: { x: it.x2, y: Y(it.y2) }, thickness: it.width, color: c(it.color), dashArray: it.dash });
      } else if (it.kind === 'path') {
        page.drawSvgPath(it.d, {
          x: 0, y: p.h,
          color: it.fill ? c(it.fill) : undefined,
          borderColor: it.width > 0 ? c(it.color) : undefined,
          borderWidth: it.width > 0 ? it.width : undefined,
          borderDashArray: it.dash,
          borderLineCap: LineCapStyle.Round,
          fillRule: it.evenOdd ? FillRule.EvenOdd : undefined,
        });
      } else if (it.kind === 'dot') {
        page.drawCircle({ x: it.cx, y: Y(it.cy), size: it.r, color: c(it.color) });
      } else if (it.kind === 'image') {
        const img = await embed(it.src);
        if (img) {
          // Keep the aspect ratio, centered in the box (same as the SVG's xMidYMid meet).
          const k = Math.min(it.w / img.width, it.h / img.height);
          const dw = img.width * k, dh = img.height * k;
          page.drawImage(img, { x: it.x + (it.w - dw) / 2, y: Y(it.y + (it.h - dh) / 2) - dh, width: dw, height: dh });
        } else {
          page.drawRectangle({ x: it.x, y: Y(it.y) - it.h, width: it.w, height: it.h, borderColor: c('#c9d6f0'), borderWidth: 1 });
        }
      } else {
        const tw = font.widthOfTextAtSize(it.text, it.size);
        const k = it.align === 'center' ? 0.5 : it.align === 'right' ? 1 : 0;
        if (it.rotate) {
          // Turned text (folded little books): step back along the turned baseline for center and right alignment.
          const r = (it.rotate * Math.PI) / 180;
          const sx = it.x - k * tw * Math.cos(r), sy = it.y - k * tw * Math.sin(r);
          page.drawText(it.text, { x: sx, y: Y(sy), size: it.size, font, color: c(it.color), rotate: degrees(-it.rotate) });
        } else page.drawText(it.text, { x: it.x - k * tw, y: Y(it.y), size: it.size, font, color: c(it.color) });
      }
    }
  }
  return doc.save();
}
