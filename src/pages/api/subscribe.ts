import type { APIRoute } from 'astro';

export const prerender = false;

// Adds an email to Kit (kit.com). Needs KIT_API_KEY in Vercel's environment variables.
// Optional: KIT_FORM_ID (starts the welcome sequence) and KIT_TAG_WAITLIST (tags membership waitlist signups).
// We only ever receive an email address and where it came from, never a child's name.
const KIT = 'https://api.kit.com/v4';
const SOURCES = new Set(['name-tracing', 'letter-tracing', 'number-tracing', 'waitlist', 'homepage']);
const ROLES = new Set(['own-kids', 'classroom', 'homeschool', 'other']);

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const POST: APIRoute = async ({ request }) => {
  let data: { email?: unknown; source?: unknown; role?: unknown };
  try { data = await request.json(); } catch { return json(400, { error: 'bad_request' }); }

  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) return json(400, { error: 'invalid_email' });
  const source = typeof data.source === 'string' && SOURCES.has(data.source) ? data.source : 'other';
  const role = typeof data.role === 'string' && ROLES.has(data.role) ? data.role : '';

  const key = import.meta.env.KIT_API_KEY ?? process.env.KIT_API_KEY;
  if (!key) return json(503, { error: 'not_configured' });
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Kit-Api-Key': key };

  try {
    const res = await fetch(`${KIT}/subscribers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email_address: email, state: 'active' }),
    });
    if (!res.ok) {
      console.error('kit subscriber error', res.status);
      return json(502, { error: 'upstream' });
    }
    const formId = import.meta.env.KIT_FORM_ID ?? process.env.KIT_FORM_ID;
    if (formId) {
      await fetch(`${KIT}/forms/${formId}/subscribers`, { method: 'POST', headers, body: JSON.stringify({ email_address: email }) });
    }
    const tagId = source === 'waitlist' ? (import.meta.env.KIT_TAG_WAITLIST ?? process.env.KIT_TAG_WAITLIST) : undefined;
    if (tagId) {
      await fetch(`${KIT}/tags/${tagId}/subscribers`, { method: 'POST', headers, body: JSON.stringify({ email_address: email }) });
    }
    return json(200, { ok: true });
  } catch (err) {
    console.error('kit request failed');
    return json(502, { error: 'upstream' });
  }
};
