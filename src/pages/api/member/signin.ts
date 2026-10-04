import type { APIRoute } from 'astro';
import { squareConfigured, customersByEmail, activeMembership, cardLast4s } from '../../../lib/server/square';
import { json, cleanEmail, setSession, hasPending } from '../../../lib/server/session';

export const prerender = false;

// Sign-in without passwords: the email must have an active Square subscription, and either it was created
// in the last 2 hours from this same browser (right after checkout) or the last 4 digits of the card on file must match.
const attempts = new Map<string, { n: number; at: number }>();

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!squareConfigured()) return json(503, { error: 'not_configured' });
  const body = await request.json().catch(() => ({}));
  const email = cleanEmail(body.email);
  const last4 = typeof body.last4 === 'string' ? body.last4.replace(/\D/g, '').slice(-4) : '';
  if (!email) return json(400, { error: 'invalid_email' });

  const a = attempts.get(email);
  if (a && Date.now() - a.at < 15 * 60_000 && a.n >= 5) return json(429, { error: 'too_many_attempts' });

  try {
    const customers = await customersByEmail(email);
    const cids = customers.map((c) => c.id);
    const sub = await activeMembership(cids);
    if (!sub) return json(404, { error: 'not_found' });

    const fresh = hasPending(cookies, email) && sub.created_at && Date.now() - Date.parse(sub.created_at) < 2 * 60 * 60_000;
    if (!fresh) {
      if (last4.length !== 4) return json(401, { error: 'need_last4' });
      const cards = (await Promise.all(cids.map(cardLast4s))).flat();
      if (!cards.includes(last4)) {
        attempts.set(email, { n: (a && Date.now() - a.at < 15 * 60_000 ? a.n : 0) + 1, at: Date.now() });
        return json(401, { error: 'no_match' });
      }
    }
    setSession(cookies, email, cids);
    attempts.delete(email);
    return json(200, { ok: true });
  } catch (e) {
    console.error('signin failed', (e as Error).message);
    return json(502, { error: 'lookup_failed' });
  }
};
