// Shared checks for /api/program/*: signed-in, active membership, same-origin POSTs, body size and rate limits.
// Usage logs carry counts only, never content, profiles or names.
import type { AstroCookies } from 'astro';
import { squareConfigured, activeMembership } from './square';
import { json, readSession, type Session } from './session';
import { familyKey } from './programStore';

export const MAX_BODY_BYTES = 64 * 1024;

// Per-instance sliding window. Serverless instances don't share it, so it is a speed bump; the per-family and
// global AI caps in the blob store are the real spend guard.
const hits = new Map<string, number[]>();
export function rateLimited(bucket: string, id: string, max: number, windowMs: number): boolean {
  const k = `${bucket}:${id}`;
  const now = Date.now();
  const list = (hits.get(k) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) { hits.set(k, list); return true; }
  list.push(now);
  hits.set(k, list);
  if (hits.size > 5000) for (const [key, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(key);
  return false;
}
export const _resetRateLimits = () => hits.clear();

/** The caller's IP as Vercel reports it (first x-forwarded-for hop). For rate limits only, never stored. */
export const clientIp = (request: Request) => request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';

/** POSTs must come from our own pages (shared with /api/member/*). */
export { sameOrigin } from './session';

export async function readJson(request: Request): Promise<{ ok: true; body: any } | { ok: false; res: Response }> {
  const len = Number(request.headers.get('content-length') ?? '0');
  if (len > MAX_BODY_BYTES) return { ok: false, res: json(413, { error: 'too_large' }) };
  const type = request.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) return { ok: false, res: json(415, { error: 'json_only' }) };
  const text = await request.text().catch(() => '');
  if (text.length > MAX_BODY_BYTES) return { ok: false, res: json(413, { error: 'too_large' }) };
  try { return { ok: true, body: JSON.parse(text) }; } catch { return { ok: false, res: json(400, { error: 'bad_json' }) }; }
}

export interface MemberCtx { session: Session; key: string }

/** Signed in AND an active (or pending) Square subscription right now. Otherwise a 401/403 Response. */
export async function requireMember(cookies: AstroCookies): Promise<{ ok: true; ctx: MemberCtx } | { ok: false; res: Response }> {
  if (!squareConfigured()) return { ok: false, res: json(503, { error: 'not_configured' }) };
  let session: Session | null = null;
  try { session = readSession(cookies); } catch { return { ok: false, res: json(503, { error: 'not_configured' }) }; }
  if (!session) return { ok: false, res: json(401, { error: 'signed_out' }) };
  try {
    const sub = await activeMembership(session.cids);
    if (!sub) return { ok: false, res: json(403, { error: 'not_member' }) };
  } catch (e) {
    // Unlike the read-only /api/member/me, program endpoints spend money, so they fail closed.
    console.error('program: membership check failed', (e as Error).message);
    return { ok: false, res: json(503, { error: 'membership_check_failed' }) };
  }
  return { ok: true, ctx: { session, key: familyKey(session.email) } };
}

export { json };
