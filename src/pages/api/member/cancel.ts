import type { APIRoute } from 'astro';
import { squareConfigured, activeMembership, cancelSubscription } from '../../../lib/server/square';
import { json, readSession, sameOrigin } from '../../../lib/server/session';

export const prerender = false;

export const POST: APIRoute = async ({ request, url, cookies }) => {
  if (!sameOrigin(request, url)) return json(403, { error: 'bad_origin' });
  if (!squareConfigured()) return json(503, { error: 'not_configured' });
  let s: ReturnType<typeof readSession> = null;
  try { s = readSession(cookies); } catch { return json(503, { error: 'not_configured' }); }
  if (!s) return json(401, { error: 'signed_out' });
  try {
    const sub = await activeMembership(s.cids);
    if (!sub) return json(404, { error: 'not_found' });
    if (sub.canceled_date) return json(200, { ok: true, cancelsOn: sub.canceled_date });
    const out = await cancelSubscription(sub.id);
    return json(200, { ok: true, cancelsOn: out?.canceled_date ?? null });
  } catch (e) {
    console.error('cancel failed', (e as Error).message);
    return json(502, { error: 'cancel_failed' });
  }
};
