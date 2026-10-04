import type { APIRoute } from 'astro';
import { sq, squareConfigured, variationFor, foundingCount, locationId, FOUNDING_LIMIT, PLANS, type PlanKey } from '../../../lib/server/square';
import { json } from '../../../lib/server/session';

export const prerender = false;

// Public health check: is Square connected, and does each plan have a matching Square subscription plan? No secrets returned.
export const GET: APIRoute = async () => {
  if (!squareConfigured()) return json(200, { configured: false });
  try {
    await locationId();
    const plans: Record<string, boolean> = {};
    for (const k of Object.keys(PLANS) as PlanKey[]) plans[k] = Boolean(await variationFor(k));
    const foundingLeft = plans.founding ? Math.max(0, FOUNDING_LIMIT - (await foundingCount())) : null;
    // What the catalog holds, so a mismatch can be diagnosed (plan names, cadences and prices only).
    const r = await sq<any>('/v2/catalog/list?types=SUBSCRIPTION_PLAN,SUBSCRIPTION_PLAN_VARIATION');
    const catalog = (r.objects ?? []).map((o: any) => ({
      type: o.type,
      name: o.subscription_plan_data?.name ?? o.subscription_plan_variation_data?.name,
      items: o.subscription_plan_data?.eligible_item_ids?.length ?? undefined,
      phases: o.subscription_plan_variation_data?.phases?.map((ph: any) => ({ cadence: ph.cadence, periods: ph.periods, pricing: ph.pricing?.type, cents: ph.pricing?.price_money?.amount ?? ph.pricing?.price?.amount ?? ph.recurring_price_money?.amount })),
    }));
    return json(200, { configured: true, connected: true, plans, foundingLeft, catalog });
  } catch (e) {
    return json(200, { configured: true, connected: false, error: (e as { status?: number }).status ?? 'unknown' });
  }
};
