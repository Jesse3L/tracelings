// Sends a short alert to the owner's webhook (NOTIFY_WEBHOOK_URL in Vercel). Works with ntfy.sh, Discord, Slack,
// or any URL that accepts JSON. Never include anything a visitor typed (child names stay in the browser).
const env = (k: string): string | undefined => (import.meta.env as Record<string, string | undefined>)[k] ?? process.env[k];

export async function notify(title: string, body: string, tags = '', fields: Record<string, string | number | boolean | null> = {}): Promise<void> {
  const url = env('NOTIFY_WEBHOOK_URL');
  if (!url) return;
  const text = `${title}\n${body}`;
  let init: RequestInit;
  if (/^https:\/\/(ntfy\.sh|[^/]*ntfy[^/]*)\//.test(url)) {
    init = { method: 'POST', body, headers: { Title: title, Tags: tags || 'page_facing_up', Priority: '3' } };
  } else if (/discord(app)?\.com\/api\/webhooks/.test(url)) {
    init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `**${title}**\n${body}` }) };
  } else if (/hooks\.slack\.com/.test(url)) {
    init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `*${title}*\n${body}` }) };
  } else {
    init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body, text, site: 'tracelings.com', time: new Date().toISOString(), time_local: new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' CT', ...fields }) };
  }
  try {
    await fetch(url, { ...init, signal: AbortSignal.timeout(3000) });
  } catch (e) {
    console.error('notify failed', (e as Error).message);
  }
}

/** "Austin, Texas, US" from Vercel's geo headers, when available. */
export function placeFrom(request: Request): string {
  const h = request.headers;
  const dec = (v: string | null) => { try { return v ? decodeURIComponent(v) : ''; } catch { return v ?? ''; } };
  return [dec(h.get('x-vercel-ip-city')), dec(h.get('x-vercel-ip-country-region')), h.get('x-vercel-ip-country') ?? ''].filter(Boolean).join(', ');
}
