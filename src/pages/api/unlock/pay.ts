import type { APIRoute } from 'astro';
import { payConfig, payItemInPlace, cardMessage } from '../../../lib/server/square';
import { json, cleanEmail, sameOrigin } from '../../../lib/server/session';
import { notify, placeFrom } from '../../../lib/server/notify';
import { recordEvent } from '../../../lib/server/events';
import { addSignup } from '../../../lib/server/email';
import { signPass, emailPassLink, PASS_CENTS, PASS_DAYS, PASS_LABEL } from '../../../lib/server/pass';

export const prerender = false;

// POST /api/unlock/pay/ {email, sourceId, verificationToken?}: buys the 30-day unlimited download pass ($4.99, one
// time) with the in-page Square card form. Returns a signed pass token the browser keeps.
export const POST: APIRoute = async ({ request, url }) => {
  if (!sameOrigin(request, url)) return json(403, { error: 'bad_origin' });
  if (!(await payConfig().catch(() => null))) return json(503, { error: 'not_configured' });
  const body = await request.json().catch(() => ({}));
  const email = cleanEmail(body?.email);
  if (!email) return json(400, { error: 'invalid_email', message: 'Check the email address; your receipt and link go there.' });
  const sourceId = typeof body?.sourceId === 'string' && /^[A-Za-z0-9:_\-]{8,256}$/.test(body.sourceId) ? body.sourceId : '';
  if (!sourceId) return json(400, { error: 'invalid_source', message: 'The card form expired. Re-enter the card and try again.' });
  const verificationToken = typeof body?.verificationToken === 'string' && body.verificationToken.length < 1024 ? body.verificationToken : undefined;
  try {
    const orderId = await payItemInPlace({ name: PASS_LABEL, cents: PASS_CENTS, note: `${PASS_LABEL} (one time, no renewal)` }, sourceId, email, verificationToken);
    const expiresAt = Date.now() + PASS_DAYS * 86_400_000;
    const token = signPass(orderId, expiresAt);
    console.log('unlock pass ok', orderId);
    await Promise.all([
      emailPassLink(email, token, expiresAt),
      addSignup(email, 'unlock-pass').catch(() => null),
      recordEvent('checkouts', { plan: '30-day unlimited pass' }),
      notify('Download pass sold', `$${(PASS_CENTS / 100).toFixed(2)} 30-day unlimited download pass.${placeFrom(request) ? `\nFrom: ${placeFrom(request)}` : ''}`, 'unlock', { event: 'pass_paid', place: placeFrom(request) || null }),
    ]);
    return json(200, { ok: true, token, expiresAt });
  } catch (e) {
    const { code, message } = cardMessage(e);
    console.error('unlock pass failed', (e as Error).message, code);
    return json(402, { error: 'payment_failed', code, message });
  }
};
