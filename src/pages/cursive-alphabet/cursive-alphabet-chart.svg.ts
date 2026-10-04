import type { APIRoute } from 'astro';
import { loadFontFromDisk } from '../../lib/fontDisk';
import { buildCursiveChart } from '../../lib/alphabetChart';
import { pageToSvg } from '../../lib/render';

// Static image of the cursive alphabet chart, rendered once at build time.
export const GET: APIRoute = async () => {
  const font = await loadFontFromDisk('cursive');
  const page = buildCursiveChart(font, { paper: 'letter', letters: 'pairs', credit: true, noTitle: true });
  const label = 'Cursive alphabet chart showing capital and lowercase cursive letters A to Z';
  const svg = pageToSvg(page)
    .replace('width="100%"', `width="${page.w}" height="${page.h}"`)
    .replace('aria-label="Worksheet preview">', `aria-label="${label}"><title>${label}</title>`);
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
};
