import type { APIRoute } from 'astro';
import { squareConfigured, variationFor, foundingCount, locationId, FOUNDING_LIMIT, PLANS, type PlanKey } from '../../../lib/server/square';
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
    return json(200, { configured: true, connected: true, plans, foundingLeft });
  } catch (e) {
    return json(200, { configured: true, connected: false, error: (e as { status?: number }).status ?? 'unknown' });
  }
};
