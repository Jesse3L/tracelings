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

// Short-lived proof that this browser started checkout for an email, so it can sign in right after paying without card digits.
const PENDING = 'tl_pending';
export function setPending(cookies: AstroCookies, email: string) {
  const body = b64(JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + 3 * 60 * 60 }));
  cookies.set(PENDING, `${body}.${sign(body)}`, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 3 * 60 * 60 });
}
export function hasPending(cookies: AstroCookies, email: string): boolean {
  const raw = cookies.get(PENDING)?.value;
  const [body, sig] = raw?.split('.') ?? [];
  if (!body || !sig) return false;
  try {
    const good = Buffer.from(sign(body)), given = Buffer.from(sig);
    if (good.length !== given.length || !timingSafeEqual(good, given)) return false;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.email === email && p.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export function clearSession(cookies: AstroCookies) {
  cookies.delete(COOKIE, { path: '/' });
}

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const cleanEmail = (v: unknown) => {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254 ? e : '';
};
