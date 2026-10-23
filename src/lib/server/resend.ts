// Minimal Resend REST client (server only). Needs RESEND_API_KEY. RESEND_BASE_URL points it at a mock in QA.
// Never logs email addresses, keys or message bodies: errors log the method, a path with addresses masked, and status.
const env = (k: string): string | undefined => (import.meta.env as Record<string, string | undefined>)[k] ?? process.env[k];

export const resendConfigured = () => Boolean(env('RESEND_API_KEY'));
const base = () => (env('RESEND_BASE_URL') ?? 'https://api.resend.com').replace(/\/$/, '');

export class ResendError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

/** Path for logs: email addresses (contact ids by email) are masked. */
const safePath = (p: string) => p.replace(/[^/?&=]+(%40|@)[^/?&]+/g, '<email>');

export interface ResendOpts { method?: string; body?: unknown; timeoutMs?: number; idempotencyKey?: string }

/** One Resend API call. Throws ResendError on a non-2xx answer or a timeout (status 0). Retries once on 429. */
export async function rs<T = any>(path: string, opts: ResendOpts = {}): Promise<T> {
  const key = env('RESEND_API_KEY');
  if (!key) throw new ResendError(0, 'not_configured', 'RESEND_API_KEY missing');
  const method = opts.method ?? (opts.body !== undefined ? 'POST' : 'GET');
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(base() + path, {
        method,
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
          ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
          'User-Agent': 'tracelings-site',
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
      });
    } catch (e) {
      console.error('resend request failed', method, safePath(path), (e as Error).name);
      throw new ResendError(0, 'network', 'Resend unreachable');
    }
    const data: any = await res.json().catch(() => ({}));
    if (res.ok) return data as T;
    if (res.status === 429 && attempt === 0) {
      const wait = Math.min(2000, Math.max(250, Number(res.headers.get('retry-after') ?? '1') * 1000));
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const code = typeof data?.name === 'string' ? data.name : 'error';
    // Resend's error messages can quote the address that was rejected, so only the code is logged.
    if (res.status !== 404) console.error('resend error', method, safePath(path), res.status, code);
    throw new ResendError(res.status, code, typeof data?.message === 'string' ? data.message.slice(0, 300) : `Resend ${res.status}`);
  }
}

export const isNotFound = (e: unknown) => e instanceof ResendError && e.status === 404;

/** Follows `has_more` / `after` pagination for list endpoints. */
export async function listAll<T = any>(path: string, max = 5000): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  for (;;) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await rs<{ data?: T[]; has_more?: boolean }>(`${path}${sep}limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`);
    const page = r.data ?? [];
    out.push(...page);
    if (!r.has_more || !page.length || out.length >= max) return out;
    after = (page[page.length - 1] as any).id;
  }
}

export const enc = encodeURIComponent;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
