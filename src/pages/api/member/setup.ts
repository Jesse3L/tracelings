import type { APIRoute } from 'astro';
import { sq, squareConfigured, clearPlanCache, variationFor, PLANS, type PlanKey } from '../../../lib/server/square';
import { json } from '../../../lib/server/session';

export const prerender = false;
const env = (k: string): string | undefined => (import.meta.env as Record<string, string | undefined>)[k] ?? process.env[k];

// One-time: create fixed-price subscription plans in Square for any plan that has no match yet. Locked by SESSION_SECRET.
export const POST: APIRoute = async ({ request }) => {
  const key = request.headers.get('x-setup-key');
  if (!squareConfigured() || !key || key !== env('SESSION_SECRET')) return json(404, {});
  const missing = [] as PlanKey[];
  for (const k of Object.keys(PLANS) as PlanKey[]) if (!(await variationFor(k))) missing.push(k);
  if (!missing.length) return json(200, { created: [] });
  const plan = await sq<any>('/v2/catalog/object', { body: { idempotency_key: crypto.randomUUID(), object: { type: 'SUBSCRIPTION_PLAN', id: '#tl-plan', subscription_plan_data: { name: 'Tracelings Membership' } } } });
  const planId = plan.catalog_object.id;
  const created: string[] = [];
  for (const k of missing) {
    const p = PLANS[k];
    await sq('/v2/catalog/object', { body: { idempotency_key: crypto.randomUUID(), object: {
      type: 'SUBSCRIPTION_PLAN_VARIATION', id: `#tl-${k}`,
      subscription_plan_variation_data: { name: `Tracelings ${p.label}`, subscription_plan_id: planId,
        phases: [{ cadence: p.cadence, ordinal: 0, pricing: { type: 'STATIC', price_money: { amount: p.cents, currency: 'USD' } } }] },
    } } });
    created.push(k);
  }
  clearPlanCache();
  return json(200, { planId, created });
};
