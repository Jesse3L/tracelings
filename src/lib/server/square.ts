// Minimal Square REST client (server only). Needs SQUARE_ACCESS_TOKEN; optional SQUARE_ENV=sandbox, SQUARE_LOCATION_ID, SQUARE_VERSION.
import { createHmac } from 'node:crypto';

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
// New checkouts sell only the two program plans. The older plans stay so anyone still subscribed to one is
// recognized as a member: they get the full personalized program too, and keep their class list size.
export type ProgramPlanKey = 'program-monthly' | 'program-annual';
export type LegacyPlanKey = 'family-monthly' | 'family-annual' | 'classroom' | 'founding';
export type PlanKey = ProgramPlanKey | LegacyPlanKey;
/** Child profiles per family in the personalized program, on every plan. */
export const MAX_CHILDREN = 4;
export const PLANS: Record<PlanKey, { label: string; cents: number; cadence: 'MONTHLY' | 'ANNUAL'; maxNames: number; maxChildren: number }> = {
  'program-monthly': { label: 'Tracelings at Home, Personalized (monthly)', cents: 1499, cadence: 'MONTHLY', maxNames: 4, maxChildren: MAX_CHILDREN },
  'program-annual': { label: 'Tracelings at Home, Personalized (yearly)', cents: 9900, cadence: 'ANNUAL', maxNames: 4, maxChildren: MAX_CHILDREN },
  'family-monthly': { label: 'Family, monthly', cents: 599, cadence: 'MONTHLY', maxNames: 8, maxChildren: MAX_CHILDREN },
  'family-annual': { label: 'Family, yearly', cents: 3900, cadence: 'ANNUAL', maxNames: 8, maxChildren: MAX_CHILDREN },
  classroom: { label: 'Classroom, yearly', cents: 7900, cadence: 'ANNUAL', maxNames: 40, maxChildren: MAX_CHILDREN },
  founding: { label: 'Founding member, yearly', cents: 2900, cadence: 'ANNUAL', maxNames: 40, maxChildren: MAX_CHILDREN },
};
/** The only plans a new checkout can buy. */
export const SELLABLE: readonly ProgramPlanKey[] = ['program-annual', 'program-monthly'];
export const isSellable = (k: unknown): k is ProgramPlanKey => typeof k === 'string' && (SELLABLE as readonly string[]).includes(k);

/** The Storybook Club: a separate, cheaper subscription (every storybook free, new ones monthly). It is NOT in PLANS,
 *  so nothing that checks for a program member ever counts a club member. Matched in Square by price and cadence. */
export const CLUB = { label: 'Tracelings Storybook Club (monthly)', cents: 999, cadence: 'MONTHLY' as const };
const CLUB_PLAN_NAME = 'Tracelings Storybook Club';
export type MembershipKind = 'program' | 'club';

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

export interface Sub { id: string; customer_id: string; plan_variation_id: string; status: string; start_date?: string; charged_through_date?: string; canceled_date?: string; created_at?: string }

export async function subscriptionsFor(customerIds: string[]): Promise<Sub[]> {
  if (!customerIds.length) return [];
  const r = await sq<any>('/v2/subscriptions/search', { body: { query: { filter: { customer_ids: customerIds, location_ids: [await locationId()] } } } });
  return r.subscriptions ?? [];
}

/** The best current membership for these customers, if any. */
export async function clubVariation(): Promise<Variation | undefined> {
  return (await planVariations()).find((v) => v.cents === CLUB.cents && v.cadence === CLUB.cadence);
}

/** The best current subscription of one kind: 'program' (default; every plan except the club) or 'club'. */
export async function activeMembership(customerIds: string[], kind: MembershipKind = 'program'): Promise<(Sub & { plan?: PlanKey }) | undefined> {
  // In-page checkouts pay the first period up front and start the subscription at the end of it, so a member can be
  // PENDING for that first period, or CANCELED before it starts after canceling: both still have paid access.
  const today = chicagoToday();
  const prepaidThenCanceled = (s: Sub) => s.status === 'CANCELED' && !!s.start_date && s.start_date > today;
  const clubId = (await clubVariation())?.id;
  const isClub = (s: Sub) => !!clubId && s.plan_variation_id === clubId;
  const subs = (await subscriptionsFor(customerIds))
    .filter((s) => (kind === 'club' ? isClub(s) : !isClub(s)))
    .filter((s) => s.status === 'ACTIVE' || s.status === 'PENDING' || prepaidThenCanceled(s))
    .map((s) => (prepaidThenCanceled(s) ? { ...s, canceled_date: s.canceled_date ?? s.start_date } : s));
  if (!subs.length) return undefined;
  subs.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const s = subs[0];
  return { ...s, plan: await planForVariation(s.plan_variation_id) };
}

export async function cardLast4s(customerId: string): Promise<string[]> {
  const r = await sq<any>(`/v2/cards?customer_id=${encodeURIComponent(customerId)}`);
  return (r.cards ?? []).filter((c: any) => c.enabled !== false).map((c: any) => String(c.last_4));
}

// Square's checkout links need plans priced on the plan itself (STATIC). ensureProgramPlans() creates the two program
// plans once, under one "Tracelings at Home, Personalized" subscription plan, when the catalog has no price+cadence match.
// It only ever creates the exact SELLABLE prices, checks first and uses fixed idempotency keys (safe to call again),
// reuses an existing plan with the same name, and never throws: without catalog write permission it logs and reports.
const PROGRAM_PLAN_NAME = 'Tracelings at Home, Personalized';
export interface EnsureResult { ok: boolean; created: ProgramPlanKey[]; missing: ProgramPlanKey[]; error?: string }
let ensuring: Promise<EnsureResult> | null = null;

export function ensureProgramPlans(): Promise<EnsureResult> {
  ensuring ??= doEnsureProgramPlans().finally(() => { ensuring = null; });
  return ensuring;
}

async function findPlanId(name: string): Promise<string | undefined> {
  let cursor: string | undefined;
  do {
    const r = await sq<any>(`/v2/catalog/list?types=SUBSCRIPTION_PLAN${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    const hit = (r.objects ?? []).find((o: any) => !o.is_deleted && o.subscription_plan_data?.name === name);
    if (hit) return hit.id;
    cursor = r.cursor;
  } while (cursor);
  return undefined;
}

async function doEnsureProgramPlans(): Promise<EnsureResult> {
  const created: ProgramPlanKey[] = [];
  const missing: ProgramPlanKey[] = [];
  try {
    for (const k of SELLABLE) if (!(await variationFor(k))) missing.push(k);
    if (!missing.length) return { ok: true, created, missing };
    let planId = await findPlanId(PROGRAM_PLAN_NAME);
    if (!planId) {
      const plan = await sq<any>('/v2/catalog/object', { body: { idempotency_key: 'tl-program-plan-v1', object: {
        type: 'SUBSCRIPTION_PLAN', id: '#tl-program-plan', subscription_plan_data: { name: PROGRAM_PLAN_NAME },
      } } });
      planId = plan.catalog_object.id as string;
    }
    for (const k of missing) {
      const p = PLANS[k];
      await sq('/v2/catalog/object', { body: { idempotency_key: `tl-program-var-v1-${planId}-${k}`, object: {
        type: 'SUBSCRIPTION_PLAN_VARIATION', id: `#tl-${k}`,
        subscription_plan_variation_data: { name: p.label, subscription_plan_id: planId,
          phases: [{ cadence: p.cadence, ordinal: 0, pricing: { type: 'STATIC', price_money: { amount: p.cents, currency: 'USD' } } }] },
      } } });
      created.push(k);
    }
    variationCache = null;
    console.log('square program plans created', created.join(','));
    return { ok: true, created, missing: [] };
  } catch (e) {
    const status = (e as { status?: number }).status;
    const hint = status === 401 || status === 403 ? ' (token lacks catalog write permission: create the plans in the Square Dashboard)' : '';
    console.error(`square ensureProgramPlans failed: ${status ?? (e as Error).message}${hint}`);
    variationCache = null;
    return { ok: false, created, missing: missing.filter((m) => !created.includes(m)), error: status ? `square_${status}` : 'unknown' };
  }
}

export interface CheckoutLink { url: string; orderId: string }

export async function createCheckout(plan: ProgramPlanKey, email: string, redirectUrl: string): Promise<CheckoutLink> {
  if (!isSellable(plan)) throw new Error(`Plan ${plan} is not for sale`);
  if (!(await variationFor(plan))) await ensureProgramPlans();
  const v = await variationFor(plan);
  if (!v) throw new Error(`No Square plan found for ${plan}`);
  const p = PLANS[plan];
  const r = await sq<any>('/v2/online-checkout/payment-links', {
    body: {
      idempotency_key: crypto.randomUUID(),
      quick_pay: { name: p.label, price_money: { amount: p.cents, currency: 'USD' }, location_id: await locationId() },
      checkout_options: { subscription_plan_id: v.id, redirect_url: redirectUrl, ask_for_shipping_address: false },
      pre_populated_data: { buyer_email: email },
    },
  });
  // The link's order is what the buyer pays. Its id goes in this browser's pending cookie so sign-in right after
  // checkout can check that this exact checkout was paid (see paidCheckoutCustomer).
  const orderId = r.payment_link?.order_id ?? r.related_resources?.orders?.[0]?.id ?? '';
  return { url: r.payment_link.url, orderId: String(orderId) };
}

/**
 * The Square customer who paid for the checkout order created in this browser, or undefined when that order is
 * not (yet) paid or has no customer. "Paid" means nothing is left to pay and there is a completed tender or the
 * order is COMPLETED. Never throws for a missing order.
 */
export async function paidCheckoutCustomer(orderId: string): Promise<{ customerId: string; createdAt?: string } | undefined> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(orderId)) return undefined;
  let r: any;
  try { r = await sq<any>(`/v2/orders/${encodeURIComponent(orderId)}`); } catch (e) { if ((e as SquareError).status === 404) return undefined; throw e; }
  const o = r?.order;
  if (!o || o.state === 'CANCELED') return undefined;
  const due = Number(o.net_amount_due_money?.amount ?? o.net_amounts?.total_money?.amount ?? NaN);
  const total = Number(o.total_money?.amount ?? 0);
  const tenders: any[] = Array.isArray(o.tenders) ? o.tenders : [];
  const paid = total > 0 && (o.state === 'COMPLETED' || (due === 0 && tenders.length > 0));
  if (!paid) return undefined;
  const customerId = o.customer_id ?? tenders.find((t) => t.customer_id)?.customer_id;
  return customerId ? { customerId: String(customerId), createdAt: o.created_at } : undefined;
}

export async function cancelSubscription(id: string): Promise<Sub> {
  const r = await sq<any>(`/v2/subscriptions/${encodeURIComponent(id)}/cancel`, { body: {} });
  return r.subscription;
}

// ---------- Coffee tips ----------
/** Tips are whole dollars between these limits. The cap keeps the link from being used for large charges. */
export const TIP_MIN = 1;
export const TIP_MAX = 200;
export const validTip = (dollars: unknown): dollars is number =>
  typeof dollars === 'number' && Number.isInteger(dollars) && dollars >= TIP_MIN && dollars <= TIP_MAX;

/** A one-time Square checkout link for a "buy us a coffee" tip. */
export async function createTipCheckout(dollars: number, redirectUrl: string): Promise<string> {
  const r = await sq<any>('/v2/online-checkout/payment-links', {
    body: {
      idempotency_key: crypto.randomUUID(),
      quick_pay: { name: `Coffee for Tracelings ($${dollars})`, price_money: { amount: dollars * 100, currency: 'USD' }, location_id: await locationId() },
      checkout_options: { redirect_url: redirectUrl, ask_for_shipping_address: false },
      payment_note: 'Tracelings coffee tip: thank you for keeping the printables free',
    },
  });
  return r.payment_link.url;
}


// ---------- In-page payments (Square Web Payments SDK) ----------
// The card form on the page sends Square's one-time token; card numbers never reach this server.

/** Public values the in-page card form needs. The application ID is public by design. */
export async function payConfig(): Promise<{ appId: string; locationId: string; sandbox: boolean } | null> {
  const appId = (env('SQUARE_APPLICATION_ID') ?? '').trim();
  if (!appId || !squareConfigured()) return null;
  return { appId, locationId: await locationId(), sandbox: env('SQUARE_ENV') === 'sandbox' };
}

/** Idempotency key tied to the one-time card token, so a resent request never charges or creates twice (Square caps keys at 45). */
const keyFor = (step: string, sourceId: string) => `tl-${step}-` + createHmac('sha256', 'tracelings-pay').update(sourceId).digest('hex').slice(0, 32);

/** Today's date (YYYY-MM-DD) in the business time zone. */
export function chicagoToday(at = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** One billing period after a YYYY-MM-DD date. Month-end days clamp (Jan 31 -> Feb 28). */
export function nextPeriod(ymd: string, cadence: 'MONTHLY' | 'ANNUAL'): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const ty = cadence === 'ANNUAL' ? y + 1 : y + (m === 12 ? 1 : 0);
  const tm = cadence === 'ANNUAL' ? m : (m % 12) + 1;
  const last = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return `${ty}-${String(tm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export class PayError extends Error { constructor(public code: string, public userMessage: string) { super(code); } }

/** Turns a Square card error into a plain sentence for the buyer. */
export function cardMessage(e: unknown): { code: string; message: string } {
  if (e instanceof PayError) return { code: e.code, message: e.userMessage };
  const code = e instanceof SquareError ? String((e.detail as any)?.errors?.[0]?.code ?? '') : '';
  const message = /CVV/.test(code) ? 'The security code (CVV) did not match. Check it and try again.'
    : /EXPIR/.test(code) ? 'The card expiration date did not match. Check it and try again.'
    : /POSTAL|ADDRESS/.test(code) ? 'The ZIP code did not match the card. Check it and try again.'
    : /DECLIN|INSUFFICIENT|GENERIC|CARD/.test(code) ? 'The card was declined. Try another card.'
    : 'The payment did not go through. Try again, or use Square’s checkout page below.';
  return { code, message };
}

async function findOrCreateCustomer(email: string, sourceId: string): Promise<string> {
  const found = await customersByEmail(email);
  if (found[0]) return found[0].id;
  const r = await sq<any>('/v2/customers', { body: { idempotency_key: keyFor('cust', sourceId), email_address: email, reference_id: 'tracelings' } });
  return r.customer.id;
}

/**
 * Program sign-up from the in-page form: saves the card to the customer, charges the first period now (so a declined
 * card is known right away, and the buyer gets Square's receipt), then starts the Square subscription on the day the
 * paid period ends. Square bills the saved card from then on. Returns the paid order's id, which the welcome sign-in
 * checks exactly like a Square checkout-page order.
 */
export async function startProgramInPlace(plan: ProgramPlanKey, email: string, sourceId: string, verificationToken?: string): Promise<{ orderId: string; startDate: string }> {
  if (!isSellable(plan)) throw new Error(`Plan ${plan} is not for sale`);
  if (!(await variationFor(plan))) await ensureProgramPlans();
  const v = await variationFor(plan);
  if (!v) throw new Error(`No Square plan found for ${plan}`);
  return startSubInPlace(PLANS[plan], v.id, email, sourceId, verificationToken);
}

/** Storybook Club sign-up from the in-page form; same steps as the program (see startSubInPlace). */
export async function startClubInPlace(email: string, sourceId: string, verificationToken?: string): Promise<{ orderId: string; startDate: string }> {
  const v = (await clubVariation()) ?? (await ensureClubPlan());
  if (!v) throw new Error('No Square plan found for the Storybook Club');
  return startSubInPlace(CLUB, v.id, email, sourceId, verificationToken);
}

async function startSubInPlace(p: { label: string; cents: number; cadence: 'MONTHLY' | 'ANNUAL' }, variationId: string, email: string, sourceId: string, verificationToken?: string): Promise<{ orderId: string; startDate: string }> {
  const loc = await locationId();
  const customerId = await findOrCreateCustomer(email, sourceId);

  const card = await sq<any>('/v2/cards', { body: {
    idempotency_key: keyFor('card', sourceId), source_id: sourceId,
    ...(verificationToken ? { verification_token: verificationToken } : {}),
    card: { customer_id: customerId, reference_id: 'tracelings-program' },
  } });
  const cardId: string = card.card.id;

  const order = await sq<any>('/v2/orders', { body: { idempotency_key: keyFor('order', sourceId), order: {
    location_id: loc, customer_id: customerId,
    line_items: [{ name: p.label, quantity: '1', base_price_money: { amount: p.cents, currency: 'USD' } }],
  } } });
  const orderId: string = order.order.id;
  const total = Number(order.order.total_money?.amount ?? 0);
  if (total !== p.cents) throw new Error('order total mismatch');

  let paymentId = '';
  try {
    const pay = await sq<any>('/v2/payments', { body: {
      idempotency_key: keyFor('pay', sourceId), source_id: cardId, customer_id: customerId,
      amount_money: { amount: total, currency: 'USD' }, order_id: orderId, location_id: loc, autocomplete: true,
      buyer_email_address: email, note: `${p.label}: first ${p.cadence === 'ANNUAL' ? 'year' : 'month'}`,
    } });
    paymentId = pay.payment?.id ?? '';
    if (pay.payment?.status !== 'COMPLETED') throw new PayError('not_completed', 'The payment did not go through. Try another card.');
  } catch (e) {
    // A declined card is not kept on file.
    await sq(`/v2/cards/${encodeURIComponent(cardId)}/disable`, { body: {} }).catch(() => {});
    throw e;
  }

  const startDate = nextPeriod(chicagoToday(), p.cadence);
  const subBody = { idempotency_key: keyFor('sub', sourceId), location_id: loc, plan_variation_id: variationId, customer_id: customerId, card_id: cardId, start_date: startDate, timezone: 'America/Chicago' };
  try {
    await sq('/v2/subscriptions', { body: subBody });
  } catch {
    try { await sq('/v2/subscriptions', { body: subBody }); }
    catch (e2) {
      // Paid but no subscription: refund in full rather than keep money for a program they can't open.
      console.error('subscription create failed after payment; refunding', paymentId, (e2 as Error).message);
      await sq(`/v2/cards/${encodeURIComponent(cardId)}/disable`, { body: {} }).catch(() => {});
      if (paymentId) await sq('/v2/refunds', { body: { idempotency_key: keyFor('refund', sourceId), payment_id: paymentId, amount_money: { amount: total, currency: 'USD' }, reason: 'Subscription could not be started' } }).catch((e3) => console.error('refund failed', paymentId, (e3 as Error).message));
      throw new PayError('subscription_failed', 'We couldn’t start the membership, so the charge was refunded in full. Please try Square’s checkout page below.');
    }
  }
  return { orderId, startDate };
}

/** A one-time coffee tip from the in-page form. */
export async function payTipInPlace(dollars: number, sourceId: string, email?: string, verificationToken?: string): Promise<string> {
  if (!validTip(dollars)) throw new Error('invalid tip');
  const loc = await locationId();
  const order = await sq<any>('/v2/orders', { body: { idempotency_key: keyFor('tiporder', sourceId), order: {
    location_id: loc, line_items: [{ name: `Coffee for Tracelings ($${dollars})`, quantity: '1', base_price_money: { amount: dollars * 100, currency: 'USD' } }],
  } } });
  const pay = await sq<any>('/v2/payments', { body: {
    idempotency_key: keyFor('tip', sourceId), source_id: sourceId,
    ...(verificationToken ? { verification_token: verificationToken } : {}),
    amount_money: { amount: dollars * 100, currency: 'USD' }, order_id: order.order.id, location_id: loc, autocomplete: true,
    ...(email ? { buyer_email_address: email } : {}),
    note: 'Tracelings coffee tip: thank you for keeping the printables free',
  } });
  if (pay.payment?.status !== 'COMPLETED') throw new PayError('not_completed', 'The payment did not go through. Try another card.');
  return order.order.id;
}

/** A one-time digital purchase from the in-page form (storybooks). Price and name come from our own catalog. */
export async function payItemInPlace(item: { name: string; cents: number; note: string }, sourceId: string, email?: string, verificationToken?: string): Promise<string> {
  const loc = await locationId();
  const order = await sq<any>('/v2/orders', { body: { idempotency_key: keyFor('itemorder', sourceId), order: {
    location_id: loc, line_items: [{ name: item.name.slice(0, 500), quantity: '1', base_price_money: { amount: item.cents, currency: 'USD' } }],
  } } });
  const pay = await sq<any>('/v2/payments', { body: {
    idempotency_key: keyFor('item', sourceId), source_id: sourceId,
    ...(verificationToken ? { verification_token: verificationToken } : {}),
    amount_money: { amount: item.cents, currency: 'USD' }, order_id: order.order.id, location_id: loc, autocomplete: true,
    ...(email ? { buyer_email_address: email } : {}),
    note: item.note.slice(0, 500),
  } });
  if (pay.payment?.status !== 'COMPLETED') throw new PayError('not_completed', 'The payment did not go through. Try another card.');
  return order.order.id;
}


let ensuringClub: Promise<Variation | undefined> | null = null;
/** Creates the Storybook Club plan in the Square catalog once (fixed idempotency keys, checks first). */
export function ensureClubPlan(): Promise<Variation | undefined> {
  ensuringClub ??= (async () => {
    const have = await clubVariation();
    if (have) return have;
    let planId = await findPlanId(CLUB_PLAN_NAME);
    if (!planId) {
      const plan = await sq<any>('/v2/catalog/object', { body: { idempotency_key: 'tl-club-plan-v1', object: {
        type: 'SUBSCRIPTION_PLAN', id: '#tl-club-plan', subscription_plan_data: { name: CLUB_PLAN_NAME },
      } } });
      planId = plan.catalog_object.id as string;
    }
    await sq('/v2/catalog/object', { body: { idempotency_key: `tl-club-var-v1-${planId}`, object: {
      type: 'SUBSCRIPTION_PLAN_VARIATION', id: '#tl-club-monthly',
      subscription_plan_variation_data: { name: CLUB.label, subscription_plan_id: planId,
        phases: [{ cadence: CLUB.cadence, ordinal: 0, pricing: { type: 'STATIC', price_money: { amount: CLUB.cents, currency: 'USD' } } }] },
    } } });
    variationCache = null;
    console.log('square club plan created');
    return clubVariation();
  })().finally(() => { ensuringClub = null; });
  return ensuringClub;
}
