// The weekly email to families. Content comes from src/data/weekly/<Sunday>.json (written each week by a scheduled
// task and pushed to the repo). Sunday evening the cron builds it into a Resend broadcast for the `prospects` segment.
// The first APPROVALS_NEEDED weeks wait for Jesse: he gets a preview with a link to a page with a "Send it" button.
// After that many approved sends, the cron sends it straight away. Records (private Blob, never deleted):
//   weekly/approved/<date>.json  one per week Jesse approved
//   weekly/sent/<date>.json      one per week sent (approved or automatic), so a retry never sends twice
import { createHmac, timingSafeEqual } from 'node:crypto';
import { weeklyEmail, weeklyProblems, withUnsubscribe, type WeeklyContent } from '../email/templates';
import { broadcastCreateFrom, broadcastSend } from './emailAdmin';
import { recordStore, chicagoDate } from './events';
import { rs } from './resend';
import { SITE } from '../../config';

export const APPROVALS_NEEDED = 3;
const env = (k: string): string | undefined => ((import.meta.env ?? {}) as Record<string, string | undefined>)[k] ?? process.env[k];

const FILES = import.meta.glob('../../data/weekly/*.json', { eager: true, import: 'default' }) as Record<string, WeeklyContent>;
export const weeklyContent = (date: string): WeeklyContent | null =>
  Object.entries(FILES).find(([f]) => f.endsWith(`/${date}.json`))?.[1] ?? null;

export const broadcastName = (date: string) => `Weekly ${date}`;
const secret = () => env('CRON_SECRET') || env('SESSION_SECRET') || '';
export const approveSig = (date: string, id: string) => createHmac('sha256', secret()).update(`weekly:${date}:${id}`).digest('base64url').slice(0, 32);
export function sigOk(date: string, id: string, sig: string): boolean {
  if (!secret()) return false;
  const a = Buffer.from(approveSig(date, id)), b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function has(path: string) { return Boolean(await recordStore()?.read(path).catch(() => null)); }
async function mark(path: string, body: unknown) { await recordStore()?.put(path, JSON.stringify(body)).catch(() => undefined); }
export async function approvals(): Promise<number> {
  const s = recordStore();
  return s ? (await s.list('weekly/approved/')).length : 0;
}

export type WeeklyResult =
  | { status: 'no_content'; date: string }
  | { status: 'invalid'; date: string; problems: string[] }
  | { status: 'already_sent'; date: string }
  | { status: 'awaiting_approval'; date: string; id: string; approvals: number }
  | { status: 'sent'; date: string; id: string; automatic: true };

/** Sunday's job. `date` defaults to today in Chicago. */
export async function runWeekly(date = chicagoDate()): Promise<WeeklyResult> {
  const c = weeklyContent(date);
  const owner = env('OWNER_EMAIL');
  if (!c) {
    if (owner) await rs('/emails', { idempotencyKey: `weekly-missing-${date}`, body: { from: 'Tracelings reports <hello@tracelings.com>', to: [owner], subject: `No weekly email for ${date}`, text: `There was no weekly email content for ${date} (src/data/weekly/${date}.json), so nothing went out this Sunday.` } }).catch(() => undefined);
    return { status: 'no_content', date };
  }
  const problems = weeklyProblems(c);
  if (problems.length) return { status: 'invalid', date, problems };
  if (await has(`weekly/sent/${date}.json`)) return { status: 'already_sent', date };
  const email = weeklyEmail(c);
  const { id } = await broadcastCreateFrom(email, broadcastName(date), 'prospects');
  const n = await approvals();
  if (n >= APPROVALS_NEEDED) {
    await broadcastSend(id);
    await mark(`weekly/sent/${date}.json`, { id, at: new Date().toISOString(), automatic: true });
    return { status: 'sent', date, id, automatic: true };
  }
  // Ask Jesse: the email itself, with a banner and the approve link on top.
  if (owner) {
    const link = `${SITE.url}/api/email/weekly-approve/?d=${date}&id=${encodeURIComponent(id)}&s=${approveSig(date, id)}`;
    const banner = `<div style="font-family:Arial,sans-serif;background:#fff4d6;border:1px solid #e8c766;border-radius:10px;padding:16px;margin:12px auto;max-width:600px;color:#1e2a44"><b>Weekly email for ${date}: ready to send.</b><br>This is approval ${n + 1} of ${APPROVALS_NEEDED}. After ${APPROVALS_NEEDED} approvals, weekly emails send on their own every Sunday.<br><br><a href="${link}" style="display:inline-block;background:#f2c14e;color:#1e2a44;padding:10px 18px;border-radius:8px;font-weight:bold;text-decoration:none">Review and send to the list</a><br><span style="font-size:13px">Nothing goes out until you press Send on that page. To change it, reply to this email.</span></div>`;
    const prev = withUnsubscribe(email, `${SITE.url}/privacy/`);
    await rs('/emails', { idempotencyKey: `weekly-approve-${date}`, body: {
      from: 'Tracelings reports <hello@tracelings.com>', to: [owner], subject: `[Approve] ${email.subject}`,
      html: prev.html.replace(/<body([^>]*)>/i, `<body$1>${banner}`), text: `Approve the weekly email for ${date}: ${link}\n\n${prev.text}`,
    } });
  }
  return { status: 'awaiting_approval', date, id, approvals: n };
}

/** Jesse pressed Send on the approve page. */
export async function approveWeekly(date: string, id: string): Promise<{ sent: boolean; already?: boolean }> {
  if (await has(`weekly/sent/${date}.json`)) return { sent: false, already: true };
  await broadcastSend(id);
  await mark(`weekly/sent/${date}.json`, { id, at: new Date().toISOString(), automatic: false });
  await mark(`weekly/approved/${date}.json`, { id, at: new Date().toISOString() });
  return { sent: true };
}
