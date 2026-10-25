import type { APIRoute } from 'astro';
import { squareConfigured, customersByEmail, activeMembership, cardLast4s, paidCheckoutCustomer, subscriptionsFor } from '../../../lib/server/square';
import { json, cleanEmail, setSession, readPending, clearPending, sameOrigin } from '../../../lib/server/session';
import { markMember } from '../../../lib/server/email';
import { rateLimited, clientIp } from '../../../lib/server/programApi';

export const prerender = false;

// Sign-in without passwords: the email must have an active Square subscription, and either
//  - this browser holds the pending cookie from its own checkout for this email, AND Square says that checkout's
//    order is paid by a customer with this email, AND that payment started this email's only subscription (a
//    brand-new member, right after paying), or
//  - the last 4 digits of a card on file match.
// Starting a checkout for someone else's email gives a pending cookie for an unpaid order, which never signs in.
const attempts = new Map<string, { n: number; at: number }>();
const SUB_SLACK_MS = 60_000; // clock skew between our server and Square, when the order has no created_at

export const POST: APIRoute = async ({ request, url, cookies }) => {
  if (!sameOrigin(request, url)) return json(403, { error: 'bad_origin' });
  if (!squareConfigured()) return json(503, { error: 'not_configured' });
  const body = await request.json().catch(() => ({}));
  const email = cleanEmail(body?.email);
  const last4 = typeof body?.last4 === 'string' ? body.last4.replace(/\D/g, '').slice(-4) : '';
  if (!email) return json(400, { error: 'invalid_email' });

  // Per IP: lookups (which also reveal whether an email has a membership) and card-digit guesses.
  const ip = clientIp(request);
  if (rateLimited('signin-ip', ip, 20, 10 * 60_000)) return json(429, { error: 'too_many_attempts' });
  if (last4 && rateLimited('signin-digits-ip', ip, 8, 15 * 60_000)) return json(429, { error: 'too_many_attempts' });
  // Per email: count a digits attempt BEFORE the Square calls, so parallel guesses can't all slip past the check.
  const a = attempts.get(email);
  const recent = a && Date.now() - a.at < 15 * 60_000 ? a : undefined;
  if (recent && recent.n >= 5) return json(429, { error: 'too_many_attempts' });
  if (last4) attempts.set(email, { n: (recent?.n ?? 0) + 1, at: recent?.at ?? Date.now() });

  try {
    const customers = await customersByEmail(email);
    const cids = customers.map((c) => c.id);
    const sub = await activeMembership(cids);
    if (!sub) return json(404, { error: 'not_found' });

    let fresh = false;
    const pending = last4 ? null : readPending(cookies, email);
    if (pending) {
      const paid = await paidCheckoutCustomer(pending.orderId);
      if (paid && cids.includes(paid.customerId)) {
        // Square's own order time (same clock as the subscription); our cookie time only as a fallback.
        const since = paid.createdAt && !Number.isNaN(Date.parse(paid.createdAt)) ? Date.parse(paid.createdAt) : pending.iat * 1000 - SUB_SLACK_MS;
        const all = await subscriptionsFor(cids);
        const fromThisCheckout = (s: (typeof all)[number]) => s.customer_id === paid.customerId && !!s.created_at && Date.parse(s.created_at) >= since;
        const madeNow = all.some((s) => fromThisCheckout(s) && (s.status === 'ACTIVE' || s.status === 'PENDING'));
        // Only a brand-new account skips the digits. If this email has any other subscription (an existing member),
        // paying a new checkout under that email must not open their account: the card digits are needed.
        fresh = madeNow && all.every(fromThisCheckout);
      }
    }
    if (!fresh) {
      // checkout: 'not_ready' tells the welcome page that this browser's checkout isn't confirmed paid yet
      // (Square can take a few seconds), so it retries before asking for the card digits.
      if (last4.length !== 4) return json(401, { error: 'need_last4', ...(pending ? { checkout: 'not_ready' } : {}) });
      const cards = (await Promise.all(cids.map(cardLast4s))).flat();
      if (!cards.includes(last4)) return json(401, { error: 'no_match' }); // already counted above
    }
    setSession(cookies, email, cids);
    clearPending(cookies);
    attempts.delete(email);
    // Email list: mark them as a member so the welcome emails stop and launch offers skip them. Best effort, short timeout.
    await markMember(email);
    return json(200, { ok: true });
  } catch (e) {
    console.error('signin failed', (e as Error).message);
    return json(502, { error: 'lookup_failed' });
  }
};
