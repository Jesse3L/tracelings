import { useState } from 'preact/hooks';
import { useMember } from '../lib/member';
import WaitlistForm from './WaitlistForm';

type PlanKey = 'founding' | 'family-annual' | 'family-monthly' | 'classroom';

const PLANS: { v: PlanKey; label: string; price: string; sub: string; badge?: string }[] = [
  { v: 'founding', label: 'Founding member', price: '$29/year', sub: 'Everything, class lists up to 40 names. Price locked for life.', badge: 'First 200 only' },
  { v: 'family-annual', label: 'Family, yearly', price: '$39/year', sub: 'Up to 8 kids in one PDF. Works out to $3.25 a month.' },
  { v: 'family-monthly', label: 'Family, monthly', price: '$5.99/month', sub: 'Up to 8 kids in one PDF. Cancel anytime.' },
  { v: 'classroom', label: 'Classroom', price: '$79/year', sub: 'One teacher, class lists up to 40 names.' },
];

export default function MembershipCheckout() {
  const member = useMember();
  const [plan, setPlan] = useState<PlanKey>('founding');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'error' | 'full' | 'down' | 'off'>('idle');

  if (member.loaded && member.member) {
    return (
      <div class="rounded-xl border border-[#9fd3b8] bg-[#eef8f2] p-6" role="status">
        <p class="font-bold text-lg text-ink">You're a member. Thank you!</p>
        <p class="mt-2 text-muted leading-relaxed">Member printing is switched on in this browser. Your plan and billing are on your account page.</p>
        <a href="/account/" class="btn-pencil mt-4 inline-block px-5 py-3 text-lg">Your account</a>
      </div>
    );
  }
  // Square isn't connected yet (or the check failed): keep collecting the waitlist instead.
  if (member.loaded && !member.available) return <WaitlistForm />;
  if (state === 'off') return <WaitlistForm />;

  async function submit(e: Event) {
    e.preventDefault();
    setState('sending');
    try {
      const r = await fetch('/api/member/checkout/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.url) {
        try { localStorage.setItem('tl-checkout-email', email.trim().toLowerCase()); } catch { /* storage unavailable */ }
        window.location.href = data.url;
        return;
      }
      if (data.error === 'invalid_email') return setState('error');
      if (data.error === 'founding_full') { setPlan('family-annual'); return setState('full'); }
      if (data.error === 'not_configured') return setState('off');
      setState('down');
    } catch {
      setState('down');
    }
  }

  return (
    <form onSubmit={submit} class="rounded-xl border border-hairline bg-white p-6">
      <h2 class="text-xl font-bold">Become a member</h2>
      <fieldset class="mt-4">
        <legend class="text-[15px] font-bold mb-2">Choose a plan</legend>
        <div class="grid gap-2">
          {PLANS.map((p) => (
            <label class={`cursor-pointer rounded-lg border px-4 py-3 ${plan === p.v ? 'border-rule shadow-[inset_0_0_0_1px_var(--color-rule)] bg-[#f6f8fc]' : 'border-hairline'}`}>
              <input type="radio" name="plan" class="sr-only" checked={plan === p.v} onChange={() => { setPlan(p.v); if (state === 'full') setState('idle'); }} />
              <span class="flex items-baseline justify-between gap-3">
                <span class="font-bold text-ink">{p.label}{p.badge && <span class="ml-2 rounded-full bg-[#fff4d6] px-2 py-0.5 text-[12px] font-bold text-[#7a5a00] align-middle">{p.badge}</span>}</span>
                <span class="font-bold text-ink whitespace-nowrap">{p.price}</span>
              </span>
              <span class="block mt-1 text-[14px] text-muted leading-snug">{p.sub}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label class="block mt-4">
        <span class="block text-[15px] font-bold mb-2">Your email</span>
        <input id="checkout-email" type="email" required autoComplete="email" value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          class="w-full rounded-lg border border-hairline px-4 py-3 text-lg focus:border-rule focus:outline-none" placeholder="you@example.com" />
        <span class="block text-[13px] text-muted mt-2">You'll use this email to sign in on other devices.</span>
      </label>
      {state === 'error' && <p class="mt-3 text-[14px] text-[#b4232c]" role="alert">That email doesn't look quite right. Mind checking it?</p>}
      {state === 'full' && <p class="mt-3 text-[14px] text-[#b4232c]" role="alert">The 200 founding spots are gone. The yearly Family plan is the next best deal.</p>}
      {state === 'down' && <p class="mt-3 text-[14px] text-[#b4232c]" role="alert">Checkout didn't open. Please try again in a minute.</p>}
      <button type="submit" disabled={state === 'sending' || !member.loaded} class="btn-pencil mt-5 w-full px-5 py-3.5 text-lg disabled:opacity-60">
        {state === 'sending' ? 'Opening secure checkout…' : 'Continue to secure checkout'}
      </button>
      <p class="mt-3 text-[13px] text-muted">Your plan renews automatically at the same price until you cancel. Cancel anytime from your account page, and get a full refund within 14 days if it's not for you. See the <a href="/terms/" class="text-[#2f5fc4] underline underline-offset-2">membership terms</a>. Payment is handled by Square; we never see your card number.</p>
      <p class="mt-2 text-[13px] text-muted">Already a member? <a href="/account/" class="text-[#2f5fc4] underline underline-offset-2">Sign in</a></p>
    </form>
  );
}
