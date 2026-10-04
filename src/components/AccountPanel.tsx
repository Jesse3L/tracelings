import { useEffect, useState } from 'preact/hooks';
import { fetchMember, type MemberState } from '../lib/member';

const fmt = (d?: string | null) => {
  if (!d) return '';
  const t = new Date(`${d.slice(0, 10)}T12:00:00`);
  return isNaN(t.getTime()) ? d : t.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const linkCls = 'text-[#2f5fc4] underline underline-offset-2';

export default function AccountPanel() {
  const [m, setM] = useState<MemberState | null>(null);
  const [welcome, setWelcome] = useState(false);
  const [email, setEmail] = useState('');
  const [last4, setLast4] = useState('');
  const [askLast4, setAskLast4] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function refresh() {
    const s = await fetchMember(true);
    setM(s);
    return s;
  }

  useEffect(() => {
    const isWelcome = new URLSearchParams(location.search).has('welcome');
    setWelcome(isWelcome);
    let saved = '';
    try { saved = localStorage.getItem('tl-checkout-email') ?? ''; } catch { /* storage unavailable */ }
    if (saved) setEmail(saved);
    refresh().then((s) => {
      // Right after checkout, sign straight in. Square can take a few seconds to create the subscription, so retry briefly.
      if (isWelcome && saved && !s.member && s.available) autoSignIn(saved, 0);
    });
  }, []);

  async function autoSignIn(addr: string, tries: number) {
    setBusy(true);
    const r = await post('/api/member/signin/', { email: addr });
    if (r.ok) { await refresh(); setBusy(false); return; }
    if (r.error === 'not_found' && tries < 5) { setTimeout(() => autoSignIn(addr, tries + 1), 3000); return; }
    setBusy(false);
    if (r.error === 'need_last4') setAskLast4(true);
  }

  async function post(url: string, body: unknown): Promise<{ ok: boolean; error?: string; cancelsOn?: string | null }> {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({}));
      return { ok: r.ok, ...data };
    } catch {
      return { ok: false, error: 'network' };
    }
  }

  async function signIn(e: Event) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await post('/api/member/signin/', { email, last4: askLast4 ? last4 : undefined });
    setBusy(false);
    if (r.ok) { await refresh(); return; }
    const text: Record<string, string> = {
      invalid_email: 'That email doesn’t look quite right.',
      not_found: 'We couldn’t find an active membership for that email. Use the email you entered at checkout.',
      no_match: 'Those digits don’t match the card on file. Check the last 4 digits of the card you paid with.',
      too_many_attempts: 'Too many tries. Please wait 15 minutes and try again.',
    };
    if (r.error === 'need_last4') { setAskLast4(true); setMsg({ kind: 'ok', text: 'Almost there. Enter the last 4 digits of the card you paid with.' }); return; }
    setMsg({ kind: 'error', text: text[r.error ?? ''] ?? 'Sign-in didn’t work just now. Please try again in a minute.' });
  }

  async function cancel() {
    setBusy(true);
    setMsg(null);
    const r = await post('/api/member/cancel/', {});
    setBusy(false);
    setConfirmCancel(false);
    if (r.ok) { await refresh(); setMsg({ kind: 'ok', text: 'Your membership is canceled. You won’t be charged again, and member printing stays on until the end of the period you paid for.' }); }
    else setMsg({ kind: 'error', text: `We couldn’t cancel just now. Please try again, or email hello@tracelings.com and we’ll do it for you.` });
  }

  async function signOut() {
    await post('/api/member/signout/', {});
    await refresh();
  }

  if (!m) return <div class="rounded-xl border border-hairline bg-white p-6 text-muted">Loading your account…</div>;

  if (!m.available) {
    return (
      <div class="rounded-xl border border-hairline bg-white p-6">
        <p class="font-bold text-lg text-ink">Membership hasn’t opened yet.</p>
        <p class="mt-2 text-muted leading-relaxed">Join the waitlist on the <a href="/membership/" class={linkCls}>membership page</a> and we’ll email you when it does.</p>
      </div>
    );
  }

  if (m.member) {
    return (
      <div class="grid gap-5">
        {welcome && (
          <div class="rounded-xl border border-[#9fd3b8] bg-[#eef8f2] p-5" role="status">
            <p class="font-bold text-lg text-ink">Welcome to Tracelings membership!</p>
            <p class="mt-1 text-muted">Member printing is on in this browser. Try a <a href="/name-tracing/" class={linkCls}>class list of names</a> to see it.</p>
          </div>
        )}
        <div class="rounded-xl border border-hairline bg-white p-6">
          <h2 class="text-xl font-bold">Your membership</h2>
          <dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
            <dt class="text-muted">Plan</dt><dd class="text-ink font-bold">{m.planLabel}</dd>
            <dt class="text-muted">Email</dt><dd class="text-ink">{m.email}</dd>
            {m.paidThrough && !m.cancelsOn && <><dt class="text-muted">Renews</dt><dd class="text-ink">{fmt(m.paidThrough)}</dd></>}
            {m.cancelsOn && <><dt class="text-muted">Ends</dt><dd class="text-ink">{fmt(m.cancelsOn)} (canceled, no further charges)</dd></>}
            <dt class="text-muted">Names per PDF</dt><dd class="text-ink">Up to {m.maxNames}</dd>
          </dl>
          <h3 class="mt-6 font-bold">What’s included now</h3>
          <ul class="mt-2 list-disc pl-5 text-[15px] text-muted space-y-1">
            <li>No footer line on any printable</li>
            <li>Several names in one PDF on the <a href="/name-tracing/" class={linkCls}>name tracing</a> tool</li>
            <li>No email prompts on downloads</li>
            <li>New member features as they launch, at no extra cost</li>
          </ul>
        </div>

        {msg && <p class={`text-[14px] ${msg.kind === 'error' ? 'text-[#b4232c]' : 'text-[#1f7a50]'}`} role={msg.kind === 'error' ? 'alert' : 'status'}>{msg.text}</p>}

        <div class="rounded-xl border border-hairline bg-white p-6 text-[15px]">
          <h2 class="text-lg font-bold">Billing</h2>
          <p class="mt-2 text-muted">Payments go through Square. Need a receipt or a card change? Email <a href={`mailto:hello@tracelings.com`} class={linkCls}>hello@tracelings.com</a>.</p>
          {!m.cancelsOn && (
            confirmCancel ? (
              <div class="mt-4 rounded-lg bg-[#fff4f4] p-4">
                <p class="text-ink">Cancel your membership? You keep member printing until {m.paidThrough ? fmt(m.paidThrough) : 'the end of the period you paid for'}, and you won’t be charged again.</p>
                <div class="mt-3 flex flex-wrap gap-3">
                  <button type="button" disabled={busy} onClick={cancel} class="rounded-lg border border-[#b4232c] px-4 py-2 font-bold text-[#b4232c] disabled:opacity-60">{busy ? 'Canceling…' : 'Yes, cancel'}</button>
                  <button type="button" onClick={() => setConfirmCancel(false)} class="rounded-lg border border-hairline px-4 py-2 font-bold text-ink">Keep membership</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmCancel(true)} class="mt-4 text-[#b4232c] underline underline-offset-2">Cancel membership</button>
            )
          )}
          <p class="mt-5"><button type="button" onClick={signOut} class={linkCls}>Sign out of this browser</button></p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={signIn} class="rounded-xl border border-hairline bg-white p-6">
      {welcome && busy ? (
        <p class="mb-4 text-[#1f7a50]" role="status">Thanks for joining! Setting up your membership…</p>
      ) : welcome ? (
        <p class="mb-4 text-ink">Thanks for joining! Sign in once below to switch on member printing in this browser.</p>
      ) : null}
      {m.lapsed && <p class="mb-4 text-[14px] text-[#b4232c]">Your membership has ended. <a href="/membership/" class={linkCls}>Rejoin anytime</a>.</p>}
      <h2 class="text-xl font-bold">Member sign in</h2>
      <p class="mt-1 text-[15px] text-muted">No password. We look up your membership by email.</p>
      <label class="block mt-4">
        <span class="block text-[15px] font-bold mb-2">Email you used at checkout</span>
        <input id="signin-email" type="email" required autoComplete="email" value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          class="w-full rounded-lg border border-hairline px-4 py-3 text-lg focus:border-rule focus:outline-none" placeholder="you@example.com" />
      </label>
      {askLast4 && (
        <label class="block mt-4">
          <span class="block text-[15px] font-bold mb-2">Last 4 digits of the card you paid with</span>
          <input id="signin-last4" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required autoComplete="off" value={last4}
            onInput={(e) => setLast4((e.target as HTMLInputElement).value.replace(/\D/g, ''))}
            class="w-32 rounded-lg border border-hairline px-4 py-3 text-lg tracking-widest focus:border-rule focus:outline-none" placeholder="1234" />
        </label>
      )}
      {msg && <p class={`mt-3 text-[14px] ${msg.kind === 'error' ? 'text-[#b4232c]' : 'text-[#1f7a50]'}`} role={msg.kind === 'error' ? 'alert' : 'status'}>{msg.text}</p>}
      <button type="submit" disabled={busy} class="btn-pencil mt-5 w-full px-5 py-3.5 text-lg disabled:opacity-60">{busy ? 'Checking…' : 'Sign in'}</button>
      <p class="mt-3 text-[13px] text-muted">Not a member yet? <a href="/membership/" class={linkCls}>See plans</a></p>
    </form>
  );
}
