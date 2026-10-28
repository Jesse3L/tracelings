import type { APIRoute } from 'astro';
import { createHash, timingSafeEqual } from 'node:crypto';
import { json, cleanEmail } from '../../../lib/server/session';
import { rateLimited } from '../../../lib/server/programApi';
import { resendConfigured, ResendError } from '../../../lib/server/resend';
import { importContacts, welcomeBackfill } from '../../../lib/server/email';
import { domainCreate, domainStatus, domainVerify, setup, setAutomations, broadcastCreate, broadcastCancel, broadcastSend, testSend, stats, isLaunchKey } from '../../../lib/server/emailAdmin';
import { SEGMENTS, type SegmentKey } from '../../../lib/email/audience';
import { allTemplates } from '../../../lib/email/templates';
import { ensureInboundWebhook } from '../../../lib/server/inbound';
import { runDigest } from '../../../lib/server/digest';
import { isDate } from '../../../lib/server/events';

export const prerender = false;

// Owner-only email admin. POST JSON { action, ... } with `Authorization: Bearer <EMAIL_ADMIN_TOKEN>`.
// 404 when EMAIL_ADMIN_TOKEN isn't set, so the endpoint doesn't exist until the owner turns it on.
// Nothing here sends to the list without { confirm: "SEND" }, and test sends only go to OWNER_EMAIL.
const env = (k: string): string | undefined => ((import.meta.env ?? {}) as Record<string, string | undefined>)[k] ?? process.env[k];
const MAX_BODY = 512 * 1024;

const digest = (s: string) => createHash('sha256').update(s).digest();
function tokenOk(header: string | null, token: string): boolean {
  const given = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';
  // Hash both sides so the comparison is constant time whatever the lengths.
  return timingSafeEqual(digest(given), digest(token)) && given.length > 0;
}
const ipOf = (request: Request) => request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';

export const ALL: APIRoute = ({ request }) => {
  if (!env('EMAIL_ADMIN_TOKEN')) return new Response('Not found', { status: 404 });
  return json(405, { error: 'post_only' });
};

export const POST: APIRoute = async ({ request }) => {
  const token = env('EMAIL_ADMIN_TOKEN');
  if (!token || token.length < 16) return new Response('Not found', { status: 404 });
  const ip = ipOf(request);
  if (rateLimited('admin-email-ip', ip, 60, 10 * 60_000)) return json(429, { error: 'rate_limited' });
  if (!tokenOk(request.headers.get('authorization'), token)) {
    // Wrong tokens get a much smaller budget.
    if (rateLimited('admin-email-bad', ip, 5, 15 * 60_000)) return json(429, { error: 'rate_limited' });
    return json(401, { error: 'unauthorized' });
  }
  if (!resendConfigured()) return json(503, { error: 'resend_not_configured' });

  const len = Number(request.headers.get('content-length') ?? '0');
  if (len > MAX_BODY) return json(413, { error: 'too_large' });
  const text = await request.text().catch(() => '');
  if (text.length > MAX_BODY) return json(413, { error: 'too_large' });
  let body: any;
  try { body = JSON.parse(text || '{}'); } catch { return json(400, { error: 'bad_json' }); }
  const action = typeof body?.action === 'string' ? body.action : '';

  try {
    switch (action) {
      case 'domain-create':
        return json(200, await domainCreate({ open_tracking: body.open_tracking === true, click_tracking: body.click_tracking === true }));
      case 'domain-status':
        return json(200, await domainStatus());
      case 'domain-verify':
        return json(200, await domainVerify());
      case 'setup':
        return json(200, await setup({ enable: body.enable === true, rebuild_automations: body.rebuild_automations === true }));
      case 'automations-enable':
        return json(200, await setAutomations('enabled'));
      case 'automations-disable':
        return json(200, await setAutomations('disabled'));
      case 'import': {
        const raw = Array.isArray(body.emails) ? body.emails : Array.isArray(body.contacts) ? body.contacts : null;
        if (!raw) return json(400, { error: 'emails_required', hint: 'emails: ["a@b.com", ...] or [{ email, source, role, date }]' });
        if (raw.length > 300) return json(400, { error: 'too_many', max: 300 });
        const items = raw.map((x: unknown) => (typeof x === 'string' ? { email: x } : x && typeof x === 'object' ? x : { email: '' }));
        const source = typeof body.source === 'string' && /^[a-z0-9-]{2,40}$/.test(body.source) ? body.source : 'import-oct-2026';
        return json(200, await importContacts(items, source, cleanEmail));
      }
      case 'broadcast-create': {
        if (!isLaunchKey(body.template)) return json(400, { error: 'unknown_template', templates: ['launch-a', 'launch-a-teacher', 'launch-b', 'launch-c'] });
        const seg = body.segment;
        if (seg !== undefined && !(typeof seg === 'string' && seg in SEGMENTS)) return json(400, { error: 'unknown_segment', segments: Object.keys(SEGMENTS) });
        return json(200, await broadcastCreate(body.template, seg as SegmentKey | undefined, { fresh: body.fresh === true }));
      }
      case 'broadcast-cancel': {
        const id = typeof body.id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(body.id) ? body.id : '';
        if (!id) return json(400, { error: 'id_required' });
        return json(200, await broadcastCancel(id));
      }
      case 'broadcast-send': {
        if (body.confirm !== 'SEND') return json(400, { error: 'confirm_required', hint: 'Add "confirm": "SEND" to send to the whole segment.' });
        const id = typeof body.id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(body.id) ? body.id : '';
        if (!id) return json(400, { error: 'id_required' });
        const at = body.scheduled_at;
        if (at !== undefined && !(typeof at === 'string' && !Number.isNaN(Date.parse(at)) && Date.parse(at) > Date.now())) {
          return json(400, { error: 'bad_scheduled_at', hint: 'ISO 8601 time in the future, e.g. 2026-10-27T15:00:00Z' });
        }
        return json(200, await broadcastSend(id, at));
      }
      case 'test-send': {
        const owner = cleanEmail(env('OWNER_EMAIL'));
        const to = cleanEmail(body.to);
        if (!owner) return json(403, { error: 'owner_email_not_set', hint: 'Set OWNER_EMAIL in Vercel to allow test sends.' });
        if (!to || to !== owner) return json(403, { error: 'test_send_owner_only' });
        const key = typeof body.template === 'string' ? body.template : '';
        if (!(key in allTemplates())) return json(400, { error: 'unknown_template', templates: Object.keys(allTemplates()) });
        return json(200, await testSend(key, to));
      }
      case 'templates':
        return json(200, { templates: Object.entries(allTemplates()).map(([k, t]) => ({ key: k, subject: t.subject, preview: t.preview })) });
      case 'stats':
        return json(200, await stats());
      case 'welcome-backfill': {
        const since = typeof body.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.since) ? body.since : '';
        if (!since) return json(400, { error: 'since_required', hint: '"since": "YYYY-MM-DD"' });
        return json(200, await welcomeBackfill(since, body.confirm !== 'START'));
      }
      case 'digest': {
        // The daily digest for one Chicago day (default yesterday). Returns the summary; emails OWNER_EMAIL only with send: true.
        if (body.date !== undefined && !isDate(body.date)) return json(400, { error: 'bad_date', hint: '"date": "YYYY-MM-DD"' });
        const send = body.send === true;
        const week = typeof body.week === 'boolean' ? body.week : undefined; // true adds the 7-day section to any day
        const r = await runDigest({ date: body.date, send, force: send, week });
        return json(200, r);
      }
      case 'inbound-webhook':
        return json(200, await ensureInboundWebhook('https://tracelings.com/api/email/inbound/'));
      default:
        return json(400, { error: 'unknown_action', actions: ['domain-create', 'domain-status', 'domain-verify', 'setup', 'automations-enable', 'automations-disable', 'import', 'broadcast-create', 'broadcast-cancel', 'broadcast-send', 'test-send', 'templates', 'stats', 'inbound-webhook', 'welcome-backfill', 'digest'] });
    }
  } catch (e) {
    if (e instanceof ResendError) return json(e.status >= 400 && e.status < 500 ? e.status : 502, { error: 'resend', code: e.code, status: e.status, message: e.message });
    console.error('admin email failed', (e as Error).message);
    return json(500, { error: 'failed' });
  }
};
