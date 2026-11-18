import type { APIRoute } from 'astro';
import { sigOk, approveWeekly, weeklyContent } from '../../../lib/server/weekly';
import { isDate } from '../../../lib/server/events';

export const prerender = false;

// The approve link in Jesse's preview email. GET shows a page with a Send button (a link alone never sends, so
// email link scanners can't send it by visiting); POST from that page sends the broadcast to the list.
const page = (title: string, body: string) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:Arial,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#1e2a44;line-height:1.5"><h1 style="font-size:24px">${title}</h1>${body}</body>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function check(url: URL, form?: FormData) {
  const get = (k: string) => String(form?.get(k) ?? url.searchParams.get(k) ?? '');
  const d = get('d'), id = get('id'), s = get('s');
  return isDate(d) && /^[A-Za-z0-9_-]{6,80}$/.test(id) && sigOk(d, id, s) ? { d, id, s } : null;
}

export const GET: APIRoute = async ({ url }) => {
  const ok = check(url);
  if (!ok) return page('This link did not work', '<p>The approve link is missing a part or has expired. Reply to the preview email instead.</p>');
  const c = weeklyContent(ok.d);
  return page(`Send the weekly email for ${ok.d}?`, `<p><b>${esc(c?.subject ?? '')}</b></p><p>This sends it now to every family on the Tracelings list (not teachers, not members).</p><form method="post"><input type="hidden" name="d" value="${ok.d}"><input type="hidden" name="id" value="${esc(ok.id)}"><input type="hidden" name="s" value="${esc(ok.s)}"><button style="background:#f2c14e;border:0;border-radius:8px;padding:12px 22px;font-size:17px;font-weight:bold;cursor:pointer">Send it</button></form>`);
};

export const POST: APIRoute = async ({ request, url }) => {
  const ok = check(url, await request.formData().catch(() => undefined));
  if (!ok) return page('This link did not work', '<p>The approve link is missing a part or has expired.</p>');
  try {
    const r = await approveWeekly(ok.d, ok.id);
    return page(r.already ? 'Already sent' : 'Sent', r.already ? '<p>This week\'s email already went out. Nothing was sent twice.</p>' : '<p>The weekly email is on its way to the list. You can close this page.</p>');
  } catch (e) {
    console.error('weekly approve failed', (e as Error).message);
    return page('Not sent', '<p>Resend did not accept it just now. Try the button again in a minute.</p>');
  }
};
