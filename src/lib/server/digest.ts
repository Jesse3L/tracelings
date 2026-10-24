// The owner's daily digest (server only): one email a day with what was downloaded, grouped by visitor, plus new
// email sign-ups and checkout starts. Records come from lib/server/events.ts. Sent by api/cron/daily-digest.ts
// (Vercel Cron) and on demand by the admin action `digest` (api/admin/email.ts).
import { rs } from './resend';
import { loadDay, chicagoYesterday, pruneOld, type DayRecords, type DownloadEvent } from './events';

const env = (k: string): string | undefined => ((import.meta.env ?? {}) as Record<string, string | undefined>)[k] ?? process.env[k];

export const DIGEST_FROM = 'Tracelings reports <hello@tracelings.com>';
export const MAX_VISITORS = 50;
const SITE = 'https://tracelings.com';

export interface VisitorDownload { at: string; time: string; path: string; what: string | null; pages: number | null; member: boolean }
export interface Visitor { n: number; place: string | null; member: boolean; downloads: VisitorDownload[] }
export interface DigestSummary {
  date: string;
  totals: { downloads: number; visitors: number; memberDownloads: number; freeDownloads: number; signups: number; checkouts: number };
  pages: { path: string; count: number }[];
  visitors: Visitor[];
  moreVisitors: number;
  signups: { at: string; time: string; email: string; source: string }[];
  checkouts: { at: string; time: string; plan: string }[];
}

const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });
const ctTime = (at: string) => { const t = Date.parse(at); return Number.isNaN(t) ? '' : timeFmt.format(t); };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Groups a day's downloads by device code (`vid`), in time order. A download without a code is its own visitor. */
export function groupVisitors(events: DownloadEvent[]): Visitor[] {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const groups = new Map<string, DownloadEvent[]>();
  sorted.forEach((e, i) => {
    const key = e.vid ? `v:${e.vid}` : `x:${i}`;
    const g = groups.get(key);
    if (g) g.push(e); else groups.set(key, [e]);
  });
  // Map keeps insertion order, which is each visitor's first download time.
  return [...groups.values()].map((list, i) => ({
    n: i + 1,
    place: [...list].reverse().find((e) => e.place)?.place ?? null,
    member: list.some((e) => e.member),
    downloads: list.map((e) => ({ at: e.at, time: ctTime(e.at), path: e.path, what: e.what, pages: e.pages, member: e.member })),
  }));
}

export function summarize(day: DayRecords): DigestSummary {
  const visitors = groupVisitors(day.events);
  const byPage = new Map<string, number>();
  for (const e of day.events) byPage.set(e.path, (byPage.get(e.path) ?? 0) + 1);
  const member = day.events.filter((e) => e.member).length;
  return {
    date: day.date,
    totals: { downloads: day.events.length, visitors: visitors.length, memberDownloads: member, freeDownloads: day.events.length - member, signups: day.signups.length, checkouts: day.checkouts.length },
    pages: [...byPage].map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count || a.path.localeCompare(b.path)),
    visitors: visitors.slice(0, MAX_VISITORS),
    moreVisitors: Math.max(0, visitors.length - MAX_VISITORS),
    signups: [...day.signups].sort((a, b) => a.at.localeCompare(b.at)).map((s) => ({ at: s.at, time: ctTime(s.at), email: s.email, source: s.source })),
    checkouts: [...day.checkouts].sort((a, b) => a.at.localeCompare(b.at)).map((c) => ({ at: c.at, time: ctTime(c.at), plan: c.plan })),
  };
}

export const isEmpty = (s: DigestSummary) => !s.totals.downloads && !s.totals.signups && !s.totals.checkouts;

// ---------- Rendering ----------
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const C = { bg: '#f6f8fb', card: '#ffffff', ink: '#1e2a44', body: '#2c3954', muted: '#5f6b82', hair: '#dce3ee', link: '#2f5fb8', pencil: '#f2c14e', member: '#1f7a50', memberBg: '#e3f4ea' };
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const longDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });

export function digestSubject(s: DigestSummary, yesterday = chicagoYesterday()): string {
  const when = s.date === yesterday ? 'yesterday' : `on ${shortDate(s.date)}`;
  return `Tracelings ${when}: ${plural(s.totals.downloads, 'download')}, ${plural(s.totals.signups, 'new email')}, ${plural(s.totals.checkouts, 'checkout')}`;
}

const dlText = (d: VisitorDownload) => `${d.what ?? 'A PDF'}${d.pages ? ` (${plural(d.pages, 'page')})` : ''} on ${d.path}`;
const visitorHead = (v: Visitor) => `Visitor ${v.n}${v.place ? ` (${v.place})` : ''}${v.member ? ', member' : ''}, ${plural(v.downloads.length, 'download')}`;

export function renderDigest(s: DigestSummary, yesterday = chicagoYesterday()): { subject: string; html: string; text: string } {
  const subject = digestSubject(s, yesterday);
  const t = s.totals;
  const P = `margin:0 0 12px;font-family:${FONT};font-size:16px;line-height:1.55;color:${C.body};`;
  const H = `margin:28px 0 10px;font-family:${FONT};font-size:18px;line-height:1.3;color:${C.ink};font-weight:700;`;
  const small = `font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};`;
  const a = (path: string) => `<a href="${esc(SITE + path)}" style="color:${C.link};text-decoration:underline;word-break:break-all;">${esc(path)}</a>`;
  const stat = (n: number, label: string) =>
    `<td class="stat" valign="top" width="33%" style="padding:6px;"><div style="background:${C.bg};border:1px solid ${C.hair};border-radius:10px;padding:12px 10px;text-align:center;">`
    + `<div style="font-family:${FONT};font-size:26px;line-height:1.1;font-weight:700;color:${C.ink};">${n}</div>`
    + `<div style="${small}margin-top:4px;">${esc(label)}</div></div></td>`;
  const badge = `<span style="display:inline-block;padding:1px 8px;border-radius:999px;background:${C.memberBg};color:${C.member};font-size:12px;font-weight:700;vertical-align:1px;">member</span>`;

  const parts: string[] = [];
  parts.push(`<h1 style="margin:0 0 4px;font-family:${FONT};font-size:22px;line-height:1.25;color:${C.ink};">Your Tracelings day</h1>`);
  parts.push(`<p style="${small}margin:0 0 16px;">${esc(longDate(s.date))}, Central time</p>`);
  parts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 -6px 4px;"><tr>${stat(t.downloads, plural(t.downloads, 'download').replace(/^\d+ /, ''))}${stat(t.visitors, t.visitors === 1 ? 'visitor' : 'visitors')}${stat(t.signups, t.signups === 1 ? 'new email' : 'new emails')}</tr></table>`);
  parts.push(`<p style="${small}margin:4px 0 0;">${esc(`${t.freeDownloads} free, ${t.memberDownloads} by members. ${plural(t.checkouts, 'checkout')} started.`)}</p>`);

  if (s.pages.length) {
    parts.push(`<h2 style="${H}">Top pages</h2>`);
    parts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${s.pages.map((p) =>
      `<tr><td style="font-family:${FONT};font-size:15px;line-height:1.5;padding:6px 0;border-bottom:1px solid ${C.hair};">${a(p.path)}</td>`
      + `<td align="right" width="70" style="font-family:${FONT};font-size:15px;line-height:1.5;padding:6px 0;border-bottom:1px solid ${C.hair};color:${C.ink};font-weight:700;white-space:nowrap;">${p.count}</td></tr>`).join('')}</table>`);
  }

  if (s.visitors.length) {
    parts.push(`<h2 style="${H}">What each visitor downloaded</h2>`);
    for (const v of s.visitors) {
      parts.push(`<div style="margin:0 0 14px;padding:12px 14px;border:1px solid ${C.hair};border-radius:10px;">`
        + `<p style="margin:0 0 6px;font-family:${FONT};font-size:15px;line-height:1.4;color:${C.ink};"><strong>Visitor ${v.n}</strong>${v.place ? ` <span style="color:${C.muted};">${esc(v.place)}</span>` : ''} ${v.member ? badge : ''}<span style="${small}"> &middot; ${esc(plural(v.downloads.length, 'download'))}</span></p>`
        + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${v.downloads.map((d) =>
          `<tr><td valign="top" width="66" style="${small}padding:2px 8px 6px 0;white-space:nowrap;">${esc(d.time)}</td>`
          + `<td valign="top" style="font-family:${FONT};font-size:15px;line-height:1.45;color:${C.body};padding:0 0 6px;">${esc(d.what ?? 'A PDF')}${d.pages ? ` <span style="color:${C.muted};">(${esc(plural(d.pages, 'page'))})</span>` : ''}`
          + `<br><span style="font-size:13px;">${a(d.path)}</span></td></tr>`).join('')}</table>`
        + `</div>`);
    }
    if (s.moreVisitors) parts.push(`<p style="${P}">And ${plural(s.moreVisitors, 'more visitor')}.</p>`);
  }

  if (s.signups.length) {
    parts.push(`<h2 style="${H}">New email sign-ups</h2>`);
    parts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${s.signups.map((u) =>
      `<tr><td style="font-family:${FONT};font-size:15px;line-height:1.45;padding:6px 0;border-bottom:1px solid ${C.hair};color:${C.ink};word-break:break-all;">${esc(u.email)}<br><span style="${small}">${esc(u.time)} &middot; from ${esc(u.source)}</span></td></tr>`).join('')}</table>`);
  }
  if (s.checkouts.length) {
    parts.push(`<h2 style="${H}">Checkouts started</h2>`);
    parts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${s.checkouts.map((c) =>
      `<tr><td valign="top" width="66" style="${small}padding:2px 8px 6px 0;white-space:nowrap;">${esc(c.time)}</td><td valign="top" style="font-family:${FONT};font-size:15px;line-height:1.45;color:${C.body};padding:0 0 6px;">${esc(c.plan)}</td></tr>`).join('')}</table>`);
    parts.push(`<p style="${small}">Square emails you when a payment goes through.</p>`);
  }
  if (isEmpty(s)) parts.push(`<p style="${P}">Nothing was downloaded and nobody signed up this day.</p>`);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<title>${esc(subject)}</title>
<style>
  body { margin:0; padding:0; background:${C.bg}; }
  @media (max-width: 620px) {
    .card { padding:20px 16px !important; border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
    .outer { padding:0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};">
<tr><td class="outer" align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
    <tr><td class="card" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.hair};border-radius:14px;padding:28px 32px;">
${parts.join('\n')}
    </td></tr>
    <tr><td style="padding:16px 8px;${small}">Sent each morning by tracelings.com to the owner. Downloads are anonymous: the page, the options picked, a rough location and a random device code. Never names or anything typed.</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const lines: string[] = [`Your Tracelings day: ${longDate(s.date)} (Central time)`, ''];
  lines.push(`${plural(t.downloads, 'download')} by ${plural(t.visitors, 'visitor')} (${t.freeDownloads} free, ${t.memberDownloads} by members)`);
  lines.push(`${plural(t.signups, 'new email sign-up')}, ${plural(t.checkouts, 'checkout')} started`);
  if (s.pages.length) { lines.push('', 'TOP PAGES'); for (const p of s.pages) lines.push(`${p.count}  ${SITE}${p.path}`); }
  if (s.visitors.length) {
    lines.push('', 'WHAT EACH VISITOR DOWNLOADED');
    for (const v of s.visitors) lines.push(`${visitorHead(v)}: ${v.downloads.map(dlText).join('; ')}`);
    if (s.moreVisitors) lines.push(`And ${plural(s.moreVisitors, 'more visitor')}.`);
  }
  if (s.signups.length) { lines.push('', 'NEW EMAIL SIGN-UPS'); for (const u of s.signups) lines.push(`${u.email} (from ${u.source}, ${u.time})`); }
  if (s.checkouts.length) { lines.push('', 'CHECKOUTS STARTED'); for (const c of s.checkouts) lines.push(`${c.plan} (${c.time})`); }
  if (isEmpty(s)) lines.push('', 'Nothing was downloaded and nobody signed up this day.');
  lines.push('', '---', 'Downloads are anonymous: the page, the options picked, a rough location and a random device code. Never names or anything typed.');
  return { subject, html, text: lines.join('\n') };
}

// ---------- Running ----------
export interface DigestResult { date: string; sent: boolean; skipped?: 'empty' | 'no_owner'; id?: string; pruned?: number; summary: DigestSummary }

/** Loads a day (default: yesterday in Chicago), and emails the owner when `send` is true and there is something
 *  to report (or `force`). `prune` also deletes records older than 35 days. */
export async function runDigest(o: { date?: string; send: boolean; force?: boolean; prune?: boolean; idempotencyKey?: string }): Promise<DigestResult> {
  const date = o.date ?? chicagoYesterday();
  const summary = summarize(await loadDay(date));
  const result: DigestResult = { date, sent: false, summary };
  if (o.prune) result.pruned = await pruneOld().catch((e) => { console.error('digest prune failed', (e as Error).message); return 0; });
  if (!o.send) return result;
  if (isEmpty(summary) && !o.force) return { ...result, skipped: 'empty' };
  const owner = env('OWNER_EMAIL')?.trim();
  if (!owner) return { ...result, skipped: 'no_owner' };
  const { subject, html, text } = renderDigest(summary);
  const r = await rs<{ id?: string }>('/emails', { body: { from: DIGEST_FROM, to: [owner], subject, html, text }, idempotencyKey: o.idempotencyKey });
  return { ...result, sent: true, id: r?.id };
}
