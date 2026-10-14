import { useState } from 'preact/hooks';

const AMOUNTS = [3, 5, 10, 20] as const;
const MIN = 1, MAX = 200;
const track = (name: string, params: Record<string, unknown> = {}) => { try { (window as any).gtag?.('event', name, { tool_page: location.pathname, ...params }); } catch { /* ignore */ } };

/** "Buy us a coffee" amounts plus a custom amount. Each opens a secure Square checkout. */
export default function CoffeeButtons(props: { source: string; onStart?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [custom, setCustom] = useState('');

  async function go(amount: number, key: string) {
    setError('');
    if (!Number.isInteger(amount) || amount < MIN || amount > MAX) { setError(`Enter a whole dollar amount from $${MIN} to $${MAX}.`); return; }
    setBusy(key);
    track('coffee_click', { amount, source: props.source, custom: key === 'custom' });
    props.onStart?.();
    try {
      const r = await fetch('/api/coffee/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) { location.href = d.url; return; }
      setError(r.status === 400 ? `Enter a whole dollar amount from $${MIN} to $${MAX}.` : 'Checkout isn’t available right now. Please try again in a minute.');
    } catch {
      setError('Checkout isn’t available right now. Please try again in a minute.');
    }
    setBusy(null);
  }

  return (
    <div>
      <div class="grid grid-cols-4 gap-2">
        {AMOUNTS.map((a) => (
          <button type="button" disabled={busy !== null} onClick={() => go(a, String(a))}
            class={`rounded-lg px-2 py-2.5 text-[15px] font-bold disabled:opacity-60 ${a === 5 ? 'btn-pencil' : 'border border-rule bg-white text-ink hover:bg-[#eef4ff]'}`}>
            {busy === String(a) ? '…' : `$${a}`}
          </button>
        ))}
      </div>
      <form class="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); go(Number(custom), 'custom'); }}>
        <label class="relative flex-1">
          <span class="sr-only">Your own amount in dollars</span>
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">$</span>
          <input type="number" inputMode="numeric" min={MIN} max={MAX} step={1} value={custom} placeholder="Your amount"
            onInput={(e) => setCustom((e.target as HTMLInputElement).value)}
            class="w-full rounded-lg border border-hairline bg-white py-2.5 pl-7 pr-3 text-[15px] text-ink focus:border-rule focus:outline-none" />
        </label>
        <button type="submit" disabled={busy !== null || !custom} class="rounded-lg border border-rule bg-white px-4 py-2.5 text-[15px] font-bold text-ink hover:bg-[#eef4ff] disabled:opacity-50">
          {busy === 'custom' ? 'Opening…' : 'Tip'}
        </button>
      </form>
      {error && <p class="mt-2 text-[13px] text-[#b4232c]" role="alert">{error}</p>}
      <p class="mt-2 text-[12px] text-muted">One-time tip through Square, any amount from $1 to $200. Nothing recurring.</p>
    </div>
  );
}
