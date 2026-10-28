import type { APIRoute } from 'astro';
import { notify, placeFrom } from '../../lib/server/notify';
import { recordEvent } from '../../lib/server/events';
import { cleanWhatStrict } from '../../lib/server/whatVocab';
import { cleanSource } from '../../lib/source';

export const prerender = false;

// Download pings from the browser. Only the page path, page count, member flag, a short label of the options picked
// (`what`, checked against lib/what.ts, never anything typed) a random device code (`vid`) and where the visit came from (`src`, a
// fixed label from lib/source.ts) are accepted;
// filenames are never sent because they can contain a child's name. Pings that pass the bot filter are also saved
// as one small private record each, for the owner's daily digest (lib/server/events.ts, api/cron/daily-digest.ts).
const hits = new Map<string, { n: number; at: number }>();

const BOT_UA = /bot|crawl|spider|slurp|headless|phantom|puppeteer|playwright|selenium|lighthouse|python|curl|wget|httpclient|go-http|java\/|node-fetch|axios|scrapy|okhttp|preview|scan/i;
const OUR_SITE = /^https:\/\/(www\.)?tracelings\.com(\/|$)|^https:\/\/tracelings-[a-z0-9-]+\.vercel\.app(\/|$)|^http:\/\/localhost(:\d+)?(\/|$)/;

/** Why a download ping looks automated, or '' if it looks like a real visitor. */
function botReason(request: Request, data: any): string {
  const ua = request.headers.get('user-agent') || '';
  if (!ua || BOT_UA.test(ua)) return 'bot user agent';
  const from = request.headers.get('origin') || request.headers.get('referer') || '';
  if (!OUR_SITE.test(from)) return 'not sent from tracelings.com';
  if (data.human !== true) return 'no human tap or click';
  if (typeof data.secs === 'number' && data.secs < 2) return 'downloaded under 2s after load';
  return '';
}

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

  // Bot filter: skip the alert (but answer 204 so bots learn nothing) when it doesn't look like a person.
  const reason = botReason(request, data);
  if (reason) {
    console.log(`download alert skipped: ${reason} | ${path} | ${placeFrom(request) || '?'} | ${(request.headers.get('user-agent') || '').slice(0, 120)}`);
    return new Response(null, { status: 204 });
  }
  const pages = Number.isInteger(data.pages) && data.pages > 0 && data.pages < 1000 ? data.pages : null;
  const who = data.member === true ? 'Member' : 'Free visitor';
  const place = placeFrom(request);
  const what = cleanWhatStrict(data.what);
  const src = cleanSource(data.src);
  const vid = typeof data.vid === 'string' && /^[a-z2-7]{16}$/.test(data.vid) ? data.vid : null;

  // Started first and capped at a short timeout, so saving the record never slows or breaks the alert.
  const saved = recordEvent('events', { path, what, pages, member: data.member === true, vid, place: place || null, src });
  await notify(
    'New Tracelings download',
    `${who} downloaded a PDF${pages ? ` (${pages} page${pages === 1 ? '' : 's'})` : ''}\nPage: tracelings.com${path}${place ? `\nFrom: ${place}` : ''}`,
    'page_facing_up',
    { event: 'download', page: `https://tracelings.com${path}`, pages, member: data.member === true, place: place || null },
  );
  await saved;
  return new Response(null, { status: 204 });
};
