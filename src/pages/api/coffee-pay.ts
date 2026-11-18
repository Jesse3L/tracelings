import type { APIRoute } from 'astro';
import { payConfig, payTipInPlace, validTip, cardMessage } from '../../lib/server/square';
import { json, cleanEmail, sameOrigin } from '../../lib/server/session';
import { notify, placeFrom } from '../../lib/server/notify';

export const prerender = false;

// POST /api/coffee-pay/ {amount, sourceId, email?, verificationToken?}: a coffee tip from the in-page Square form.
export const POST: APIRoute = async ({ request, url }) => {
  if (!sameOrigin(request, url)) return json(403, { error: 'bad_origin' });
  if (!(await payConfig().catch(() => null))) return json(503, { error: 'not_configured' });
  const body = await request.json().catch(() => ({}));
  const dollars = Number(body?.amount);
  if (!validTip(dollars)) return json(400, { error: 'invalid_amount' });
  const sourceId = typeof body?.sourceId === 'string' && /^[A-Za-z0-9:_\-]{8,256}$/.test(body.sourceId) ? body.sourceId : '';
  if (!sourceId) return json(400, { error: 'invalid_source', message: 'The card form expired. Re-enter the card and try again.' });
  const email = cleanEmail(body?.email) || undefined;
  const verificationToken = typeof body?.verificationToken === 'string' && body.verificationToken.length < 1024 ? body.verificationToken : undefined;
  try {
    const orderId = await payTipInPlace(dollars, sourceId, email, verificationToken);
    await notify('Coffee tip received', `Someone tipped $${dollars} on the site (in-page card form).${placeFrom(request) ? `\nFrom: ${placeFrom(request)}` : ''}`, 'coffee', { event: 'coffee_paid_in_page', amount: dollars, place: placeFrom(request) || null });
    console.log('coffee pay ok', dollars, orderId);
    return json(200, { ok: true });
  } catch (e) {
    const { code, message } = cardMessage(e);
    console.error('coffee pay failed', (e as Error).message, code);
    return json(402, { error: 'payment_failed', code, message });
  }
};
