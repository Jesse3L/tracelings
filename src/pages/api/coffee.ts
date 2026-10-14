import type { APIRoute } from 'astro';
import { squareConfigured, createTipCheckout, validTip } from '../../lib/server/square';
import { notify, placeFrom } from '../../lib/server/notify';

export const prerender = false;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Starts a one-time "buy us a coffee" tip through Square. Any whole-dollar amount from $1 to $200.
export const POST: APIRoute = async ({ request, url }) => {
  if (!squareConfigured()) return json(503, { error: 'not_configured' });
  const body = await request.json().catch(() => ({}));
  const dollars = Number(body.amount);
  if (!validTip(dollars)) return json(400, { error: 'invalid_amount' });
  try {
    const checkoutUrl = await createTipCheckout(dollars, `${url.origin}/support/thank-you/`);
    await notify('Coffee checkout started', `Someone opened a $${dollars} coffee tip checkout.${placeFrom(request) ? `\nFrom: ${placeFrom(request)}` : ''}\nSquare emails you if the payment goes through.`, 'coffee', { event: 'coffee_checkout_started', amount: dollars, place: placeFrom(request) || null });
    return json(200, { url: checkoutUrl });
  } catch (e) {
    console.error('coffee checkout failed', (e as Error).message);
    return json(502, { error: 'checkout_failed' });
  }
};
