import type { APIRoute } from 'astro';
import { json, clearSession } from '../../../lib/server/session';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  clearSession(cookies);
  return json(200, { ok: true });
};
