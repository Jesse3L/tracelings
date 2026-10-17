import type { APIRoute } from 'astro';
import { json, clearSession, clearPending, sameOrigin } from '../../../lib/server/session';

export const prerender = false;

export const POST: APIRoute = async ({ request, url, cookies }) => {
  if (!sameOrigin(request, url)) return json(403, { error: 'bad_origin' });
  clearSession(cookies);
  clearPending(cookies);
  return json(200, { ok: true });
};
