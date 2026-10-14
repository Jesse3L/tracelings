import { useState } from 'preact/hooks';

const AMOUNTS = [3, 5, 10] as const;
const track = (name: string, params: Record<string, unknown> = {}) => { try { (window as any).gtag?.('event', name, { tool_page: location.pathname, ...params }); } catch { /* ignore */ } };

/** Three "buy us a coffee" amounts. Each opens a secure Square checkout. */
export default function CoffeeButtons(props: { source: string; onStart?: () => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  async function go(amount: number) {
    setError('');
    setBusy(amount);
    track('coffee_click', { amount, source: props.source });
    props.onStart?.();
    try {
      const r = await fetch('/api/coffee/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) { location.href = d.url; return; }
      setError('Checkout isn’t available right now. Please try again in a minute.');
    } catch {
      setError('Checkout isn’t available right now. Please try again in a minute.');
    }
    setBusy(null);
  }
  return (
    <div>
      <div class="grid grid-cols-3 gap-2">
        {AMOUNTS.map((a) => (
          <button type="button" disabled={busy !== null} onClick={() => go(a)}
            class={`rounded-lg px-3 py-2.5 text-[15px] font-bold disabled:opacity-60 ${a === 5 ? 'btn-pencil' : 'border border-rule bg-white text-ink hover:bg-[#eef4ff]'}`}>
            {busy === a ? 'Opening…' : `$${a}`}
          </button>
        ))}
      </div>
      {error && <p class="mt-2 text-[13px] text-[#b4232c]" role="alert">{error}</p>}
      <p class="mt-2 text-[12px] text-muted">One-time tip through Square. Nothing recurring.</p>
    </div>
  );
}
