import type { Page } from './sheet';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function pageToSvg(p: Page): string {
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
    } else {
      const anchor = it.align === 'center' ? 'middle' : it.align === 'right' ? 'end' : 'start';
      out.push(`<text x="${it.x}" y="${it.y}" font-size="${it.size}" fill="${it.color}" text-anchor="${anchor}" font-family="Helvetica, Arial, sans-serif">${esc(it.text)}</text>`);
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
  const { PDFDocument, rgb, StandardFonts, LineCapStyle } = await import('@cantoo/pdf-lib');
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setCreator('Tracelings');
  doc.setProducer('Tracelings');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const c = (h: string) => rgb(...hex(h));

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
        });
      } else if (it.kind === 'dot') {
        page.drawCircle({ x: it.cx, y: Y(it.cy), size: it.r, color: c(it.color) });
      } else {
        const tw = font.widthOfTextAtSize(it.text, it.size);
        const x = it.align === 'center' ? it.x - tw / 2 : it.align === 'right' ? it.x - tw : it.x;
        page.drawText(it.text, { x, y: Y(it.y), size: it.size, font, color: c(it.color) });
      }
    }
  }
  return doc.save();
}
