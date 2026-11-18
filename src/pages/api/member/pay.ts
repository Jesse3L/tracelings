import type { APIRoute } from 'astro';
import { payConfig, startProgramInPlace, isSellable, PLANS, cardMessage } from '../../../lib/server/square';
import { json, cleanEmail, setPending, sameOrigin } from '../../../lib/server/session';
import { notify, placeFrom } from '../../../lib/server/notify';
import { recordEvent } from '../../../lib/server/events';

export const prerender = false;

// POST /api/member/pay/ {plan, email, sourceId, verificationToken?}: program sign-up from the in-page Square card form.
// Only the plan, email and Square's one-time card token arrive here. On success the browser gets the same pending
// cookie as a Square checkout-page purchase, so /account/?welcome=1 signs the new member straight in.
export const POST: APIRoute = async ({ request, url, cookies }) => {
  if (!sameOrigin(request, url)) return json(403, { error: 'bad_origin' });
  if (!(await payConfig().catch(() => null))) return json(503, { error: 'not_configured' });
  const body = await request.json().catch(() => ({}));
  const email = cleanEmail(body?.email);
  const plan = body?.plan;
  if (!email) return json(400, { error: 'invalid_email', message: 'Check the email address above.' });
  if (!isSellable(plan)) return json(400, { error: 'invalid_plan' });
  const sourceId = typeof body?.sourceId === 'string' && /^[A-Za-z0-9:_\-]{8,256}$/.test(body.sourceId) ? body.sourceId : '';
  if (!sourceId) return json(400, { error: 'invalid_source', message: 'The card form expired. Re-enter the card and try again.' });
  const verificationToken = typeof body?.verificationToken === 'string' && body.verificationToken.length < 1024 ? body.verificationToken : undefined;
  try {
    const { orderId, startDate } = await startProgramInPlace(plan, email, sourceId, verificationToken);
    setPending(cookies, email, orderId);
    const saved = recordEvent('checkouts', { plan: PLANS[plan].label });
    await notify('New program member', `Someone paid for ${PLANS[plan].label} on the site (in-page card form). Square billing starts ${startDate}.${placeFrom(request) ? `\nFrom: ${placeFrom(request)}` : ''}`, 'tada', { event: 'program_paid_in_page', plan: PLANS[plan].label, place: placeFrom(request) || null });
    await saved;
    console.log('program pay ok', plan, orderId); // no card data
    return json(200, { ok: true, orderId });
  } catch (e) {
    const { code, message } = cardMessage(e);
    console.error('program pay failed', (e as Error).message, code);
    return json(402, { error: 'payment_failed', code, message });
  }
};
