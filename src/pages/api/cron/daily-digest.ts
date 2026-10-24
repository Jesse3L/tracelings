import type { APIRoute } from 'astro';
import { createHash, timingSafeEqual } from 'node:crypto';
import { runDigest } from '../../../lib/server/digest';
import { chicagoYesterday } from '../../../lib/server/events';
import { ResendError } from '../../../lib/server/resend';

export const prerender = false;

// The owner's daily digest, run by Vercel Cron (vercel.json, 12:05 UTC: about 7am Central). Vercel sends
// `Authorization: Bearer $CRON_SECRET`; anything else gets a 401. Emails yesterday's (America/Chicago) downloads,
// sign-ups and checkout starts to OWNER_EMAIL, skips the email on a day with nothing (unless ?force=1), and deletes
// records older than 35 days. The response holds only counts, never addresses.
const env = (k: string): string | undefined => ((import.meta.env ?? {}) as Record<string, string | undefined>)[k] ?? process.env[k];
const digest = (s: string) => createHash('sha256').update(s).digest();

export function cronAuthorized(header: string | null): boolean {
  const secret = env('CRON_SECRET');
  if (!secret) return false;
  const given = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';
  return given.length > 0 && timingSafeEqual(digest(given), digest(secret));
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request, url }) => {
  if (!cronAuthorized(request.headers.get('authorization'))) return json(401, { error: 'unauthorized' });
  const date = chicagoYesterday();
  try {
    // One email per day even if Vercel retries the cron (Resend keeps idempotency keys for 24 hours).
    const force = url.searchParams.get('force') === '1';
    const r = await runDigest({ date, send: true, force, prune: true, idempotencyKey: force ? undefined : `digest-${date}` });
    return json(200, { date: r.date, sent: r.sent, skipped: r.skipped ?? null, id: r.id ?? null, pruned: r.pruned ?? 0, totals: r.summary.totals });
  } catch (e) {
    if (e instanceof ResendError) { console.error('digest send failed', e.status, e.code); return json(502, { error: 'resend', status: e.status, code: e.code }); }
    console.error('digest failed', (e as Error).message);
    return json(500, { error: 'failed' });
  }
};
