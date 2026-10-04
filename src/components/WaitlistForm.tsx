import { useState } from 'preact/hooks';
import { subscribe, markEmailOk } from '../lib/gate';

const ROLES = [
  { v: 'own-kids', label: 'My own kids' },
  { v: 'classroom', label: 'My classroom' },
  { v: 'homeschool', label: 'Homeschool' },
  { v: 'other', label: 'Something else' },
];

export default function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error' | 'down'>('idle');

  async function submit(e: Event) {
    e.preventDefault();
    setState('sending');
    const r = await subscribe(email, 'waitlist', role || undefined);
    if (r === 'invalid') return setState('error');
    if (r === 'unavailable') return setState('down');
    markEmailOk();
    setState('done');
  }

  if (state === 'done') {
    return (
      <div class="rounded-xl border border-[#9fd3b8] bg-[#eef8f2] p-6" role="status">
        <p class="font-bold text-lg text-ink">You're on the list.</p>
        <p class="mt-2 text-muted leading-relaxed">We'll email you as soon as membership opens so you can claim the $29/year founding price. In the meantime, everything on the site is still free to use.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} class="rounded-xl border border-hairline bg-white p-6">
      <h2 class="text-xl font-bold">Get on the founding member waitlist</h2>
      <label class="block mt-4">
        <span class="block text-[15px] font-bold mb-2">Your email</span>
        <input id="waitlist-email" type="email" required autoComplete="email" value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          class="w-full rounded-lg border border-hairline px-4 py-3 text-lg focus:border-rule focus:outline-none" placeholder="you@example.com" />
      </label>
      <fieldset class="mt-4">
        <legend class="text-[15px] font-bold mb-2">I'm mostly printing for <span class="font-normal text-muted">(optional)</span></legend>
        <div class="grid grid-cols-2 gap-2">
          {ROLES.map((r) => (
            <label class={`cursor-pointer rounded-lg border px-3 py-2 text-[15px] ${role === r.v ? 'border-rule shadow-[inset_0_0_0_1px_var(--color-rule)] text-ink' : 'border-hairline text-muted'}`}>
              <input type="radio" name="role" class="sr-only" checked={role === r.v} onChange={() => setRole(r.v)} />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      {state === 'error' && <p class="mt-3 text-[14px] text-[#b4232c]" role="alert">That email doesn't look quite right. Mind checking it?</p>}
      {state === 'down' && <p class="mt-3 text-[14px] text-[#b4232c]" role="alert">We couldn't save your email just now. Please try again in a minute.</p>}
      <button type="submit" disabled={state === 'sending'} class="btn-pencil mt-5 w-full px-5 py-3.5 text-lg disabled:opacity-60">
        {state === 'sending' ? 'Joining…' : 'Join the waitlist'}
      </button>
      <p class="mt-3 text-[13px] text-muted">We'll email you about the membership and new printables. Unsubscribe anytime.</p>
    </form>
  );
}
