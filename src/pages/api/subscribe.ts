import type { APIRoute } from 'astro';
import { notify, placeFrom } from '../../lib/server/notify';
import { addSignup } from '../../lib/server/email';
import { recordEvent } from '../../lib/server/events';

export const prerender = false;

// Saves an email sign-up in two places at once:
//  - the owner's webhook (NOTIFY_WEBHOOK_URL, Zapier -> Google Sheet), as before;
//  - Resend (RESEND_API_KEY): a contact with source and signup_date, which starts the welcome emails.
// The download goes ahead if either one saved it. We only ever receive an email address, the tool it came from
// and an optional role, never a child's name.
const SOURCES = { has: (v: string) => /^[a-z0-9-]{2,40}$/.test(v) }; // any tool slug, e.g. 'name-tracing'
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
  const place = placeFrom(request);

  // The digest record (lib/server/events.ts) always resolves within a short timeout, so it never holds up the sign-up.
  const [sheet, resend] = await Promise.all([
    notify(
      source === 'waitlist' ? 'New waitlist sign-up' : 'New email sign-up',
      `${email}\nFrom the ${source} page${role ? ` (${role})` : ''}${place ? `\nPlace: ${place}` : ''}`,
      'email',
      { event: source === 'waitlist' ? 'waitlist_signup' : 'email_signup', email, source, role: role || null, place: place || null },
    ),
    addSignup(email, source, role || undefined).catch(() => ({ saved: false })),
    recordEvent('signups', { email, source }),
  ]);
  return sheet || resend.saved ? json(200, { ok: true }) : json(503, { error: 'not_configured' });
};
