import type { APIRoute } from 'astro';
import { loadFontFromDisk } from '../../lib/fontDisk';
import { cursivePairSvg } from '../../lib/alphabetChart';

export function getStaticPaths() {
  return 'abcdefghijklmnopqrstuvwxyz'.split('').map((letter) => ({ params: { letter } }));
}

// Large capital and lowercase cursive letter on guide lines, rendered at build time.
export const GET: APIRoute = async ({ params }) => {
  const l = String(params.letter);
  const font = await loadFontFromDisk('cursive');
  const svg = cursivePairSvg(font, l, `Cursive capital ${l.toUpperCase()} and lowercase ${l}`);
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
};
