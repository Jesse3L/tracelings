import { useEffect, useRef, useState } from 'preact/hooks';
import { subscribe, markEmailOk, atDailyLimit, hasEmail, DAILY_FREE } from '../lib/gate';
import { fetchMember } from '../lib/member';
import DownloadLimit from './DownloadLimit';

// Shown before the first download on a device (the download goes ahead once an email is given), and again on
// download #8 of the day, when it shows the unlock screen instead.
export default function EmailGate(props: { open: boolean; source: string; onDone: () => void; onClose: () => void }) {
  const [limit, setLimit] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!props.open) return;
    if (hasEmail() && atDailyLimit()) {
      setLimit(true);
      // A Storybook Club member who isn't recognised yet on this page load goes straight through.
      fetchMember().then(() => { if (!atDailyLimit()) { setLimit(false); props.onDone(); } });
    } else setLimit(false);
  }, [props.open]);

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
    markEmailOk(email);
    if (atDailyLimit()) { setLimit(true); return; }
    props.onDone();
  }

  if (limit) {
    return (
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1e2a44]/45 p-4" role="dialog" aria-modal="true" aria-labelledby="gate-title" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
        <DownloadLimit source={props.source} onDone={() => { setLimit(false); props.onDone(); }} onClose={props.onClose} />
      </div>
    );
  }

  return (
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1e2a44]/45 p-4" role="dialog" aria-modal="true" aria-labelledby="gate-title" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <form onSubmit={submit} class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 id="gate-title" class="text-xl font-bold text-ink">Get your free printable</h2>
        <p class="mt-2 text-muted leading-relaxed">
          Add your email once and you can print up to {DAILY_FREE} free printables a day on this device, with no password. We'll send a new printable now and then, plus the occasional member offer.
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
          {sending ? 'One moment…' : 'Download my free printable'}
        </button>
        <p class="mt-3 text-[13px] text-muted">We'll email you about new printables and membership. Unsubscribe anytime. We never ask for your child's information.</p>
        <p class="mt-3 text-[13px] text-muted">Already a member? <a href="/account/" class="underline underline-offset-2">Sign in</a></p>
        <button type="button" onClick={props.onClose} class="mt-2 text-[14px] text-muted underline underline-offset-2">Cancel</button>
      </form>
    </div>
  );
}
