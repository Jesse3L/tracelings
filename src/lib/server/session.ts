// Signed session cookie for members. No database: the cookie holds the Square customer ids, and membership is re-checked with Square.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';

const env = (k: string): string | undefined => (import.meta.env as Record<string, string | undefined>)[k] ?? process.env[k];
const COOKIE = 'tl_member';
const MAX_AGE = 60 * 60 * 24 * 60; // 60 days

export interface Session { email: string; cids: string[]; exp: number }

function secret(): string {
  const s = env('SESSION_SECRET');
  if (!s || s.length < 32) throw new Error('SESSION_SECRET missing');
  return s;
}
const b64 = (s: string) => Buffer.from(s).toString('base64url');
const sign = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url');

export function setSession(cookies: AstroCookies, email: string, cids: string[]) {
  const body = b64(JSON.stringify({ email, cids, exp: Math.floor(Date.now() / 1000) + MAX_AGE } satisfies Session));
  cookies.set(COOKIE, `${body}.${sign(body)}`, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: MAX_AGE });
}

export function readSession(cookies: AstroCookies): Session | null {
  const raw = cookies.get(COOKIE)?.value;
  if (!raw) return null;
  const [body, sig] = raw.split('.');
  if (!body || !sig) return null;
  try {
    const good = Buffer.from(sign(body));
    const given = Buffer.from(sig);
    if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
    const s = JSON.parse(Buffer.from(body, 'base64url').toString()) as Session;
    return s.exp > Date.now() / 1000 ? s : null;
  } catch {
    return null;
  }
}

// Short-lived note that this browser opened a Square checkout for an email. It holds the id of that checkout's
// Square order, so sign-in right after paying can skip the card digits only when THAT order was paid by a customer
// with this email (see /api/member/signin). Anyone can start a checkout for any email, so the cookie on its own
// never signs anyone in.
const PENDING = 'tl_pending';
const PENDING_AGE = 3 * 60 * 60;
export interface Pending { email: string; orderId: string; iat: number; exp: number }
export function setPending(cookies: AstroCookies, email: string, orderId: string) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64(JSON.stringify({ email, orderId, iat: now, exp: now + PENDING_AGE } satisfies Pending));
  cookies.set(PENDING, `${body}.${sign(body)}`, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: PENDING_AGE });
}
/** The signed, unexpired pending checkout this browser holds for this email, or null. */
export function readPending(cookies: AstroCookies, email: string): Pending | null {
  const raw = cookies.get(PENDING)?.value;
  const [body, sig] = raw?.split('.') ?? [];
  if (!body || !sig) return null;
  try {
    const good = Buffer.from(sign(body)), given = Buffer.from(sig);
    if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as Pending;
    if (p.email !== email || !(p.exp > Date.now() / 1000) || typeof p.orderId !== 'string' || !p.orderId || !Number.isFinite(p.iat)) return null;
    return p;
  } catch {
    return null;
  }
}
export function clearPending(cookies: AstroCookies) {
  cookies.delete(PENDING, { path: '/' });
}

export function clearSession(cookies: AstroCookies) {
  cookies.delete(COOKIE, { path: '/' });
}

/** State-changing POSTs must come from our own pages (Origin, or Sec-Fetch-Site when Origin is missing). */
export function sameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get('origin');
  if (origin) return origin === url.origin;
  const site = request.headers.get('sec-fetch-site');
  return site === 'same-origin';
}

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const cleanEmail = (v: unknown) => {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254 ? e : '';
};
