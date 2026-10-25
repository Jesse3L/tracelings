import type { APIRoute } from 'astro';
import { squareConfigured, activeMembership, PLANS, MAX_CHILDREN } from '../../../lib/server/square';
import { json, readSession } from '../../../lib/server/session';
import { markMember } from '../../../lib/server/email';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!squareConfigured()) return json(200, { member: false, available: false });
  let s: ReturnType<typeof readSession> = null;
  try { s = readSession(cookies); } catch { return json(200, { member: false, available: false }); }
  if (!s) return json(200, { member: false, available: true });
  try {
    const sub = await activeMembership(s.cids);
    if (!sub) return json(200, { member: false, available: true, email: s.email, lapsed: true });
    const plan = sub.plan;
    // Tag the email-list contact as a member (once per instance every few hours; never fails the request).
    await markMember(s.email, 1500);
    return json(200, {
      member: true,
      available: true,
      email: s.email,
      plan: plan ?? null,
      planLabel: plan ? PLANS[plan].label : 'Membership',
      maxNames: plan ? PLANS[plan].maxNames : 8,
      maxChildren: MAX_CHILDREN,
      program: true, // every active plan, old or new, includes the personalized program
      status: sub.status,
      paidThrough: sub.charged_through_date ?? null,
      cancelsOn: sub.canceled_date ?? null,
    });
  } catch {
    // If Square is unreachable, trust a valid session for now rather than locking a paying member out.
    return json(200, { member: true, available: true, email: s.email, plan: null, planLabel: 'Membership', maxNames: 8, maxChildren: MAX_CHILDREN, program: true, degraded: true });
  }
};
