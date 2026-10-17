import type { APIRoute } from 'astro';
import { squareConfigured, createCheckout, isSellable, PLANS } from '../../../lib/server/square';
import { json, cleanEmail, setPending, sameOrigin } from '../../../lib/server/session';
import { notify, placeFrom } from '../../../lib/server/notify';

export const prerender = false;

// New checkouts can only buy the two program plans (program-annual, program-monthly).
export const POST: APIRoute = async ({ request, url, cookies }) => {
  if (!sameOrigin(request, url)) return json(403, { error: 'bad_origin' });
  if (!squareConfigured()) return json(503, { error: 'not_configured' });
  const body = await request.json().catch(() => ({}));
  const email = cleanEmail(body?.email);
  const plan = body?.plan;
  if (!email) return json(400, { error: 'invalid_email' });
  if (!isSellable(plan)) return json(400, { error: 'invalid_plan' });
  try {
    const link = await createCheckout(plan, email, `${url.origin}/account/?welcome=1`);
    // Remember this checkout's order in this browser. Sign-in only trusts it once Square says that order is paid.
    if (link.orderId) setPending(cookies, email, link.orderId);
    await notify('Checkout started', `Someone opened Square checkout for ${PLANS[plan].label}.${placeFrom(request) ? `\nFrom: ${placeFrom(request)}` : ''}\nSquare emails you when a payment goes through.`, 'credit_card', { event: 'checkout_started', plan: PLANS[plan].label, place: placeFrom(request) || null });
    return json(200, { url: link.url });
  } catch (e) {
    console.error('checkout failed', (e as Error).message);
    return json(502, { error: 'checkout_failed' });
  }
};
