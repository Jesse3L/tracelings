import { useEffect, useRef, useState } from 'preact/hooks';
import { subscribe, markEmailOk } from '../lib/gate';

// Shown before the second download on a device. The download goes ahead once an email is given.
export default function EmailGate(props: { open: boolean; source: string; onDone: () => void; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (props.open) setTimeout(() => input.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && props.open) props.onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.open]);

  if (!props.open) return null;

  async function submit(e: Event) {
    e.preventDefault();
    setError('');
    setSending(true);
    const r = await subscribe(email, props.source);
    setSending(false);
    if (r === 'invalid') { setError('That email doesn’t look quite right. Mind checking it?'); return; }
    // If the email service is down, don't block a parent from printing.
    markEmailOk();
    props.onDone();
  }

  return (
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1e2a44]/45 p-4" role="dialog" aria-modal="true" aria-labelledby="gate-title" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <form onSubmit={submit} class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 id="gate-title" class="text-xl font-bold text-ink">Keep printing for free</h2>
        <p class="mt-2 text-muted leading-relaxed">
          Add your email once and every worksheet on this device stays free. We'll send a new printable now and then, and you'll hear first when membership opens.
        </p>
        <label class="block mt-5">
          <span class="block text-[15px] font-bold mb-2">Your email</span>
          <input
            ref={input}
            id="gate-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            class="w-full rounded-lg border border-hairline px-4 py-3 text-lg focus:border-rule focus:outline-none"
            placeholder="you@example.com"
          />
        </label>
        {error && <p class="mt-2 text-[14px] text-[#b4232c]" role="alert">{error}</p>}
        <button type="submit" disabled={sending} class="btn-pencil mt-5 w-full px-5 py-3.5 text-lg disabled:opacity-60">
          {sending ? 'One moment…' : 'Download my worksheet'}
        </button>
        <p class="mt-3 text-[13px] text-muted">We'll email you about new printables and membership. Unsubscribe anytime. We never ask for your child's information.</p>
        <button type="button" onClick={props.onClose} class="mt-3 text-[14px] text-muted underline underline-offset-2">Not now</button>
      </form>
    </div>
  );
}
