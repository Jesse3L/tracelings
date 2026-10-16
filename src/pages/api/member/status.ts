import type { APIRoute } from 'astro';
import { squareConfigured, variationFor, locationId, PLANS, SELLABLE, type PlanKey } from '../../../lib/server/square';
import { json } from '../../../lib/server/session';

export const prerender = false;

// Public health check: is Square connected, and does each plan have a matching Square subscription plan? No secrets returned.
// `sellable` lists the plans new checkouts offer; the rest are older plans kept for existing members.
export const GET: APIRoute = async () => {
  if (!squareConfigured()) return json(200, { configured: false });
  try {
    await locationId();
    const plans: Record<string, boolean> = {};
    for (const k of Object.keys(PLANS) as PlanKey[]) plans[k] = Boolean(await variationFor(k));
    return json(200, { configured: true, connected: true, plans, sellable: SELLABLE });
  } catch (e) {
    return json(200, { configured: true, connected: false, error: (e as { status?: number }).status ?? 'unknown' });
  }
};
