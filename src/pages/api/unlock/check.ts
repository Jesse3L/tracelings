import type { APIRoute } from 'astro';
import { json } from '../../../lib/server/session';
import { readPass } from '../../../lib/server/pass';

export const prerender = false;

// GET /api/unlock/check/?t=TOKEN: confirms an emailed pass link is genuine before a new device switches it on.
export const GET: APIRoute = async ({ url }) => {
  let p: ReturnType<typeof readPass> = null;
  try { p = readPass(url.searchParams.get('t')); } catch (e) { console.error('unlock check failed', (e as Error).message); return json(503, { ok: false, error: 'unavailable' }); }
  if (!p) return json(400, { ok: false, error: 'invalid' });
  if (p.expiresAt < Date.now()) return json(410, { ok: false, error: 'expired', expiresAt: p.expiresAt });
  return json(200, { ok: true, expiresAt: p.expiresAt });
};
