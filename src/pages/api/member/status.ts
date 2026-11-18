import type { APIRoute } from 'astro';
import { squareConfigured, variationFor, locationId, PLANS, SELLABLE, clubVariation, ensureClubPlan, type PlanKey } from '../../../lib/server/square';
import { json } from '../../../lib/server/session';

export const prerender = false;

// Public health check: is Square connected, and does each plan have a matching Square subscription plan? No secrets returned.
// `sellable` lists the plans new checkouts offer; the rest are older plans kept for existing members.
// ?ensure=club creates the Storybook Club plan in Square if it is missing (one fixed plan, safe to repeat).
export const GET: APIRoute = async ({ url }) => {
  if (!squareConfigured()) return json(200, { configured: false });
  try {
    await locationId();
    const plans: Record<string, boolean> = {};
    for (const k of Object.keys(PLANS) as PlanKey[]) plans[k] = Boolean(await variationFor(k));
    let club = Boolean(await clubVariation());
    if (!club && url.searchParams.get('ensure') === 'club') club = Boolean(await ensureClubPlan().catch((e) => { console.error('ensure club failed', (e as Error).message); return undefined; }));
    return json(200, { configured: true, connected: true, plans, club, sellable: SELLABLE });
  } catch (e) {
    return json(200, { configured: true, connected: false, error: (e as { status?: number }).status ?? 'unknown' });
  }
};
