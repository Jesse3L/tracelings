import type { APIRoute } from 'astro';
import { squareConfigured, createCheckout, foundingCount, FOUNDING_LIMIT, PLANS, type PlanKey } from '../../../lib/server/square';
import { json, cleanEmail, setPending } from '../../../lib/server/session';
import { notify, placeFrom } from '../../../lib/server/notify';

export const prerender = false;

export const POST: APIRoute = async ({ request, url, cookies }) => {
  if (!squareConfigured()) return json(503, { error: 'not_configured' });
  const body = await request.json().catch(() => ({}));
  const email = cleanEmail(body.email);
  const plan = body.plan as PlanKey;
  if (!email) return json(400, { error: 'invalid_email' });
  if (!(plan in PLANS)) return json(400, { error: 'invalid_plan' });
  try {
    if (plan === 'founding' && (await foundingCount()) >= FOUNDING_LIMIT) return json(409, { error: 'founding_full' });
    const checkoutUrl = await createCheckout(plan, email, `${url.origin}/account/?welcome=1`);
    setPending(cookies, email);
    await notify('Checkout started', `Someone opened Square checkout for ${PLANS[plan].label}.${placeFrom(request) ? `\nFrom: ${placeFrom(request)}` : ''}\nSquare emails you when a payment goes through.`, 'credit_card');
    return json(200, { url: checkoutUrl });
  } catch (e) {
    console.error('checkout failed', (e as Error).message);
    return json(502, { error: 'checkout_failed' });
  }
};
