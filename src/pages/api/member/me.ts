import type { APIRoute } from 'astro';
import { squareConfigured, activeMembership, PLANS } from '../../../lib/server/square';
import { json, readSession } from '../../../lib/server/session';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!squareConfigured()) return json(200, { member: false, available: false });
  const s = readSession(cookies);
  if (!s) return json(200, { member: false, available: true });
  try {
    const sub = await activeMembership(s.cids);
    if (!sub) return json(200, { member: false, available: true, email: s.email, lapsed: true });
    const plan = sub.plan;
    return json(200, {
      member: true,
      available: true,
      email: s.email,
      plan: plan ?? null,
      planLabel: plan ? PLANS[plan].label : 'Membership',
      maxNames: plan ? PLANS[plan].maxNames : 8,
      status: sub.status,
      paidThrough: sub.charged_through_date ?? null,
      cancelsOn: sub.canceled_date ?? null,
    });
  } catch {
    // If Square is unreachable, trust a valid session for now rather than locking a paying member out.
    return json(200, { member: true, available: true, email: s.email, plan: null, planLabel: 'Membership', maxNames: 8, degraded: true });
  }
};
