import type { APIRoute } from 'astro';
import { notify, placeFrom } from '../../lib/server/notify';

export const prerender = false;

// Download pings from the browser. Only the page path, page count and member flag are accepted;
// filenames are never sent because they can contain a child's name.
const hits = new Map<string, { n: number; at: number }>();

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || clientAddress || 'unknown';
  const now = Date.now();
  const h = hits.get(ip);
  const n = h && now - h.at < 10 * 60_000 ? h.n + 1 : 1;
  hits.set(ip, { n, at: h && now - h.at < 10 * 60_000 ? h.at : now });
  if (n > 20) return new Response(null, { status: 204 });

  let data: any = {};
  try { data = JSON.parse(await request.text()); } catch { return new Response(null, { status: 400 }); }
  const path = typeof data.path === 'string' && /^\/[a-z0-9\-/]{0,100}$/.test(data.path) ? data.path : null;
  if (data.type !== 'download' || !path) return new Response(null, { status: 400 });
  const pages = Number.isInteger(data.pages) && data.pages > 0 && data.pages < 1000 ? data.pages : null;
  const who = data.member === true ? 'Member' : 'Free visitor';
  const place = placeFrom(request);

  await notify(
    'New Tracelings download',
    `${who} downloaded a PDF${pages ? ` (${pages} page${pages === 1 ? '' : 's'})` : ''}\nPage: tracelings.com${path}${place ? `\nFrom: ${place}` : ''}`,
    'page_facing_up',
  );
  return new Response(null, { status: 204 });
};
