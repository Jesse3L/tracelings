// Minimal Square REST client (server only). Needs SQUARE_ACCESS_TOKEN; optional SQUARE_ENV=sandbox, SQUARE_LOCATION_ID, SQUARE_VERSION.
const env = (k: string): string | undefined => (import.meta.env as Record<string, string | undefined>)[k] ?? process.env[k];

export const squareConfigured = () => Boolean(env('SQUARE_ACCESS_TOKEN'));

const base = () => env('SQUARE_BASE_URL') ?? (env('SQUARE_ENV') === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com');

export class SquareError extends Error {
  constructor(public status: number, public detail: unknown) { super(`Square API ${status}`); }
}

export async function sq<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(base() + path, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Bearer ${env('SQUARE_ACCESS_TOKEN')}`,
      'Square-Version': env('SQUARE_VERSION') ?? '2025-01-23',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('square error', path, res.status, JSON.stringify((data as any)?.errors ?? data).slice(0, 500));
    throw new SquareError(res.status, data);
  }
  return data as T;
}

let locationCache: string | null = null;
export async function locationId(): Promise<string> {
  if (env('SQUARE_LOCATION_ID')) return env('SQUARE_LOCATION_ID')!;
  if (locationCache) return locationCache;
  const r = await sq<{ locations?: { id: string; status: string }[] }>('/v2/locations');
  const loc = r.locations?.find((l) => l.status === 'ACTIVE') ?? r.locations?.[0];
  if (!loc) throw new Error('No Square location found');
  return (locationCache = loc.id);
}

// ---------- Plans ----------
export type PlanKey = 'family-monthly' | 'family-annual' | 'classroom' | 'founding';
export const PLANS: Record<PlanKey, { label: string; cents: number; cadence: 'MONTHLY' | 'ANNUAL'; maxNames: number }> = {
  'family-monthly': { label: 'Family, monthly', cents: 599, cadence: 'MONTHLY', maxNames: 8 },
  'family-annual': { label: 'Family, yearly', cents: 3900, cadence: 'ANNUAL', maxNames: 8 },
  classroom: { label: 'Classroom, yearly', cents: 7900, cadence: 'ANNUAL', maxNames: 40 },
  founding: { label: 'Founding member, yearly', cents: 2900, cadence: 'ANNUAL', maxNames: 40 },
};
export const FOUNDING_LIMIT = 200;

interface Variation { id: string; cents: number; cadence: string; name: string }
let variationCache: { at: number; list: Variation[] } | null = null;

/** Reads subscription plan variations from the Square catalog (created in the Square Dashboard) and matches them by price and cadence. */
export async function planVariations(): Promise<Variation[]> {
  if (variationCache && Date.now() - variationCache.at < 10 * 60_000) return variationCache.list;
  const list: Variation[] = [];
  let cursor: string | undefined;
  do {
    const r = await sq<any>(`/v2/catalog/list?types=SUBSCRIPTION_PLAN_VARIATION${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    for (const o of r.objects ?? []) {
      if (o.is_deleted) continue;
      const d = o.subscription_plan_variation_data;
      const phases = (d?.phases ?? []).filter((p: any) => p.periods == null || p.periods > 0);
      const last = d?.phases?.[d.phases.length - 1];
      const money = last?.pricing?.price_money ?? last?.pricing?.price ?? last?.recurring_price_money;
      if (!money || phases.length === 0) continue;
      list.push({ id: o.id, cents: Number(money.amount), cadence: last.cadence, name: d.name ?? '' });
    }
    cursor = r.cursor;
  } while (cursor);
  variationCache = { at: Date.now(), list };
  return list;
}

export async function variationFor(plan: PlanKey): Promise<Variation | undefined> {
  const p = PLANS[plan];
  return (await planVariations()).find((v) => v.cents === p.cents && v.cadence === p.cadence);
}

export async function planForVariation(variationId: string): Promise<PlanKey | undefined> {
  const v = (await planVariations()).find((x) => x.id === variationId);
  if (!v) return undefined;
  return (Object.keys(PLANS) as PlanKey[]).find((k) => PLANS[k].cents === v.cents && PLANS[k].cadence === v.cadence);
}

// ---------- Customers and subscriptions ----------
export async function customersByEmail(email: string): Promise<{ id: string }[]> {
  const r = await sq<any>('/v2/customers/search', { body: { query: { filter: { email_address: { exact: email } } }, limit: 10 } });
  return r.customers ?? [];
}

export interface Sub { id: string; customer_id: string; plan_variation_id: string; status: string; charged_through_date?: string; canceled_date?: string; created_at?: string }

export async function subscriptionsFor(customerIds: string[]): Promise<Sub[]> {
  if (!customerIds.length) return [];
  const r = await sq<any>('/v2/subscriptions/search', { body: { query: { filter: { customer_ids: customerIds, location_ids: [await locationId()] } } } });
  return r.subscriptions ?? [];
}

/** The best current membership for these customers, if any. */
export async function activeMembership(customerIds: string[]): Promise<(Sub & { plan?: PlanKey }) | undefined> {
  const subs = (await subscriptionsFor(customerIds)).filter((s) => s.status === 'ACTIVE' || s.status === 'PENDING');
  if (!subs.length) return undefined;
  subs.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const s = subs[0];
  return { ...s, plan: await planForVariation(s.plan_variation_id) };
}

export async function cardLast4s(customerId: string): Promise<string[]> {
  const r = await sq<any>(`/v2/cards?customer_id=${encodeURIComponent(customerId)}`);
  return (r.cards ?? []).filter((c: any) => c.enabled !== false).map((c: any) => String(c.last_4));
}

export async function foundingCount(): Promise<number> {
  const v = await variationFor('founding');
  if (!v) return 0;
  let n = 0;
  let cursor: string | undefined;
  do {
    const r = await sq<any>('/v2/subscriptions/search', { body: { cursor, limit: 200, query: { filter: { location_ids: [await locationId()] } } } });
    n += (r.subscriptions ?? []).filter((s: Sub) => s.plan_variation_id === v.id && s.status !== 'CANCELED').length;
    cursor = r.cursor;
  } while (cursor);
  return n;
}

// Square's checkout links need plans priced on the plan itself (STATIC). If a plan has no match, create it once
// under a single "Tracelings Membership" plan. Only ever creates the exact prices in PLANS.
let ensuring: Promise<void> | null = null;
async function ensurePlans(): Promise<void> {
  const missing = [] as PlanKey[];
  for (const k of Object.keys(PLANS) as PlanKey[]) if (!(await variationFor(k))) missing.push(k);
  if (!missing.length) return;
  const plan = await sq<any>('/v2/catalog/object', { body: { idempotency_key: `tl-plan-${missing.join('-')}`, object: { type: 'SUBSCRIPTION_PLAN', id: '#tl-plan', subscription_plan_data: { name: 'Tracelings Membership' } } } });
  const planId = plan.catalog_object.id;
  for (const k of missing) {
    const p = PLANS[k];
    await sq('/v2/catalog/object', { body: { idempotency_key: `tl-var-${planId}-${k}`, object: {
      type: 'SUBSCRIPTION_PLAN_VARIATION', id: `#tl-${k}`,
      subscription_plan_variation_data: { name: `Tracelings ${p.label}`, subscription_plan_id: planId,
        phases: [{ cadence: p.cadence, ordinal: 0, pricing: { type: 'STATIC', price_money: { amount: p.cents, currency: 'USD' } } }] },
    } } });
  }
  variationCache = null;
}

export async function createCheckout(plan: PlanKey, email: string, redirectUrl: string): Promise<string> {
  if (!(await variationFor(plan))) {
    ensuring ??= ensurePlans().finally(() => { ensuring = null; });
    await ensuring;
  }
  const v = await variationFor(plan);
  if (!v) throw new Error(`No Square plan found for ${plan}`);
  const p = PLANS[plan];
  const r = await sq<any>('/v2/online-checkout/payment-links', {
    body: {
      idempotency_key: crypto.randomUUID(),
      quick_pay: { name: `Tracelings membership: ${p.label}`, price_money: { amount: p.cents, currency: 'USD' }, location_id: await locationId() },
      checkout_options: { subscription_plan_id: v.id, redirect_url: redirectUrl, ask_for_shipping_address: false },
      pre_populated_data: { buyer_email: email },
    },
  });
  return r.payment_link.url;
}

export async function cancelSubscription(id: string): Promise<Sub> {
  const r = await sq<any>(`/v2/subscriptions/${encodeURIComponent(id)}/cancel`, { body: {} });
  return r.subscription;
}
