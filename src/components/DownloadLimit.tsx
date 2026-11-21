import { useState } from 'preact/hooks';
import SquarePayForm from './SquarePayForm';
import { DAILY_FREE, savePass, savedEmail } from '../lib/gate';
import { fetchMember } from '../lib/member';

const track = (name: string, params: Record<string, unknown> = {}) => { try { (window as any).gtag?.('event', name, { tool_page: location.pathname, ...params }); } catch { /* ignore */ } };
const okEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

// Shown by EmailGate on download #8 of the day. Two ways to keep printing: a one-time 30-day pass ($4.99) or the
// Storybook Club ($9.99/month, which also includes unlimited downloads). Or come back tomorrow for 7 more free.
export default function DownloadLimit(props: { source: string; onDone: () => void; onClose: () => void }) {
  const [plan, setPlan] = useState<'pass' | 'club'>('pass');
  const [email, setEmail] = useState(savedEmail());
  const [emailErr, setEmailErr] = useState(false);
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState('');

  async function buyPass(sourceId: string, verificationToken?: string) {
    const r = await fetch('/api/unlock/pay/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), sourceId, verificationToken }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) return { ok: false as const, message: d.message, code: d.code || d.error };
    savePass(d.token);
    track('unlock_pass_bought', { from: props.source });
    props.onDone();
    return { ok: true as const };
  }

  async function joinClub(sourceId: string, verificationToken?: string) {
    const r = await fetch('/api/storybook/club-join/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), sourceId, verificationToken }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) return { ok: false as const, message: d.message, code: d.code || d.error };
    // Sign in right away with this browser's checkout, same as joining from the storybook page.
    let signed = false;
    for (let i = 0; i < 4 && !signed; i++) {
      const sr = await fetch('/api/member/signin/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) });
      signed = sr.ok;
      if (!signed) await new Promise((ok) => setTimeout(ok, 2500));
    }
    try { localStorage.setItem('tl-checkout-email', email.trim().toLowerCase()); } catch { /* ignore */ }
    await fetchMember(true);
    // The card was charged, so this download goes ahead even if sign-in is slow.
    try { (window as any).__tlUnlimited = true; } catch { /* ignore */ }
    track('unlock_club_joined', { from: props.source });
    props.onDone();
    return { ok: true as const };
  }

  const option = (key: 'pass' | 'club', title: string, price: string, text: string, badge?: string) => (
    <label class={`cursor-pointer rounded-lg border px-4 py-3 ${plan === key ? 'border-rule shadow-[inset_0_0_0_1px_var(--color-rule)] bg-[#f6f8fc]' : 'border-hairline'}`}>
      <input type="radio" name="unlock-plan" class="sr-only" checked={plan === key} onChange={() => { setPlan(key); setPaying(false); track('unlock_pick', { plan: key }); }} />
      <span class="flex items-baseline justify-between gap-3">
        <span class="font-bold text-ink">{title}{badge && <span class="ml-2 whitespace-nowrap rounded-full bg-[#fff4d6] px-2 py-0.5 text-[12px] font-bold text-[#7a5a00] align-middle">{badge}</span>}</span>
        <span class="font-bold text-ink whitespace-nowrap">{price}</span>
      </span>
      <span class="block mt-1 text-[14px] text-muted leading-snug">{text}</span>
    </label>
  );

  return (
    <div class="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
      <h2 id="gate-title" class="text-xl font-bold text-ink">You've used today's {DAILY_FREE} free downloads</h2>
      <p class="mt-2 text-muted leading-relaxed">
        Printing for the whole family or a classroom? Keep going with unlimited downloads, or come back tomorrow for {DAILY_FREE} more free.
      </p>
      <div class="mt-4 grid gap-2" role="radiogroup" aria-label="How to unlock">
        {option('pass', '30 days unlimited', '$4.99', 'Print as much as you like for 30 days. One-time payment, nothing renews.', 'No subscription')}
        {option('club', 'Storybook Club', '$9.99/month', 'Unlimited downloads plus every personalized storybook, with new stories each month. Cancel anytime.')}
      </div>
      {!paying ? (
        <div class="mt-4 grid gap-3">
          <label class="block">
            <span class="block text-[14px] mb-1">{plan === 'club' ? 'Your email (you sign in with it)' : 'Your email (for the receipt and a link for your other devices)'}</span>
            <input type="email" value={email} onInput={(e) => { setEmail((e.target as HTMLInputElement).value); setEmailErr(false); }} autoComplete="email" placeholder="you@example.com" class="w-full rounded-lg border border-hairline px-4 py-3 text-lg focus:border-rule focus:outline-none" />
          </label>
          {emailErr && <p class="text-[14px] text-[#b4232c]" role="alert">That email doesn't look quite right.</p>}
          <button type="button" onClick={() => { if (!okEmail(email)) return setEmailErr(true); setPaying(true); track('unlock_pay_open', { plan }); }} class="btn-pencil w-full px-5 py-3.5 text-lg">
            {plan === 'club' ? 'Join the Storybook Club' : 'Unlock 30 days for $4.99'}
          </button>
        </div>
      ) : plan === 'club' ? (
        <div class="mt-4">
          <SquarePayForm key="club" cents={999} label="Tracelings Storybook Club" intent="STORE" squarePage={false} buttonText="Pay {total} and join"
            note={`Renews at $9.99 a month until you cancel (cancel anytime on your account page). Receipt goes to ${email.trim()}.`} source="unlock-club"
            onToken={joinClub} onFallback={() => { setPaying(false); setErr('The card form could not load. Please try again in a minute, or email hello@tracelings.com.'); }} onClose={() => setPaying(false)} />
        </div>
      ) : (
        <div class="mt-4">
          <SquarePayForm key="pass" cents={499} label="Tracelings 30 days unlimited" intent="CHARGE" wallets squarePage={false} buttonText="Pay {total} and keep printing"
            note={`One-time payment, nothing renews. Receipt goes to ${email.trim()}.`} source="unlock-pass"
            onToken={buyPass} onFallback={() => { setPaying(false); setErr('The card form could not load. Please try again in a minute, or email hello@tracelings.com.'); }} onClose={() => setPaying(false)} />
        </div>
      )}
      {err && <p class="mt-3 text-[14px] text-[#b4232c]" role="alert">{err}</p>}
      <p class="mt-4 text-[13px] text-muted">Already a member? <a href="/account/" class="underline underline-offset-2">Sign in</a></p>
      <button type="button" onClick={props.onClose} class="mt-2 text-[14px] text-muted underline underline-offset-2">Maybe tomorrow</button>
    </div>
  );
}
