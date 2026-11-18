// In-page Square payment form, so people pay without leaving tracelings.com.
// Card numbers go into Square's own secure fields (iframes from web.squarecdn.com); this page only receives a
// one-time token, which onToken() sends to our server. Apple Pay / Google Pay show above the card when allowed
// (wallets: true) and the device supports them; Apple Pay also needs tracelings.com registered with Square.
// If the form cannot load (not configured, script blocked), onFallback() opens Square's own checkout page instead,
// and after any failed attempt a "pay on Square's page" button appears so nobody gets stuck on a card error.
import { useEffect, useRef, useState } from 'preact/hooks';

type Cfg = { appId: string; locationId: string; sandbox: boolean };
export type PayResult = { ok: true } | { ok: false; message?: string; code?: string };

let sdk: Promise<any> | null = null;
function loadSdk(sandbox: boolean): Promise<any> {
  if ((window as any).Square) return Promise.resolve((window as any).Square);
  if (sdk) return sdk;
  sdk = new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = sandbox ? 'https://sandbox.web.squarecdn.com/v1/square.js' : 'https://web.squarecdn.com/v1/square.js';
    s.async = true;
    s.onload = () => ((window as any).Square ? ok((window as any).Square) : fail(new Error('no Square')));
    s.onerror = () => { sdk = null; fail(new Error('script failed')); };
    document.head.appendChild(s);
  });
  return sdk;
}

const track = (name: string, params: Record<string, unknown> = {}) => { try { (window as any).gtag?.('event', name, { tool_page: location.pathname, ...params }); } catch { /* ignore */ } };
const money = (cents: number) => '$' + (cents / 100).toFixed(2);
let seq = 0;

export default function SquarePayForm(props: {
  cents: number;
  label: string; // shown on the wallet sheet, e.g. "Tracelings at Home (yearly)"
  intent: 'CHARGE' | 'STORE'; // STORE when the card is saved for a subscription
  wallets?: boolean; // Apple/Google Pay can't be saved for renewals, so subscriptions use the card only
  buttonText: string;
  note?: string;
  source: string; // analytics label
  onToken: (sourceId: string, verificationToken?: string) => Promise<PayResult>;
  onFallback: () => void;
  onClose?: () => void;
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'paying' | 'done'>('loading');
  const [msg, setMsg] = useState('');
  const [failed, setFailed] = useState(0);
  const [wallets, setWallets] = useState({ apple: false, google: false });
  const card = useRef<any>(null), apple = useRef<any>(null), google = useRef<any>(null), payments = useRef<any>(null);
  const box = useRef<HTMLDivElement>(null);
  const ids = useRef({ card: `sq-card-${++seq}`, gpay: `sq-gpay-${seq}` }).current;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/pay-config/');
        if (!r.ok) throw new Error('config ' + r.status);
        const c: Cfg = await r.json();
        const Square = await loadSdk(c.sandbox);
        if (!alive) return;
        const pm = Square.payments(c.appId, c.locationId);
        payments.current = pm;
        const cd = await pm.card();
        if (!alive) { try { cd.destroy(); } catch {} return; }
        await cd.attach('#' + ids.card);
        card.current = cd;
        setState('ready');
        track('pay_form_shown', { source: props.source });
        setTimeout(() => box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        if (!props.wallets) return;
        const req = () => pm.paymentRequest({ countryCode: 'US', currencyCode: 'USD', total: { amount: (props.cents / 100).toFixed(2), label: props.label } });
        try { const ap = await pm.applePay(req()); if (alive) { apple.current = ap; setWallets((w) => ({ ...w, apple: true })); } } catch { /* not Safari / domain not registered */ }
        try {
          const gp = await pm.googlePay(req());
          if (!alive) return;
          await gp.attach('#' + ids.gpay, { buttonColor: 'black', buttonSizeMode: 'fill', buttonType: 'long' });
          google.current = gp; setWallets((w) => ({ ...w, google: true }));
        } catch { /* Google Pay unavailable */ }
      } catch (e) {
        console.error('pay form failed', e);
        if (alive) { track('pay_form_failed', { source: props.source, reason: String((e as Error)?.message ?? e).slice(0, 60) }); props.onFallback(); }
      }
    })();
    return () => { alive = false; for (const m of [card, google, apple]) { try { m.current?.destroy(); } catch {} } };
  }, [props.cents]);

  function fail(text: string, reason: string) {
    setMsg(text); setFailed((n) => n + 1); setState('ready');
    track('pay_failed', { source: props.source, reason: reason.slice(0, 60) });
  }

  async function pay(method: 'card' | 'apple' | 'google') {
    const src = method === 'card' ? card.current : method === 'apple' ? apple.current : google.current;
    if (!src || state === 'paying' || state === 'done') return;
    setMsg(''); setState('paying'); track('pay_submit', { source: props.source, method });
    let t: any;
    try { t = await src.tokenize(); }
    catch { fail('That did not go through. Try again, or use the button below to pay on Square’s secure page.', 'tokenize_threw'); return; }
    if (t?.status !== 'OK') {
      if (method !== 'card' && /CANCEL/i.test(String(t?.status))) { setState('ready'); return; }
      fail(t?.errors?.[0]?.message ?? 'Check the card details and try again.', String(t?.errors?.[0]?.field ?? t?.status ?? 'invalid'));
      return;
    }
    // Strong customer authentication when the bank asks for it; most US cards skip this silently.
    let verificationToken: string | undefined;
    if (method === 'card') {
      try {
        const v = await payments.current.verifyBuyer(t.token, props.intent === 'STORE'
          ? { intent: 'STORE', billingContact: {} }
          : { intent: 'CHARGE', amount: (props.cents / 100).toFixed(2), currencyCode: 'USD', billingContact: {} });
        verificationToken = v?.token;
      } catch { /* verification not available; the charge can still go through */ }
    }
    try {
      const r = await props.onToken(t.token, verificationToken);
      if (r.ok) { setState('done'); track('pay_success', { source: props.source, method }); return; }
      fail(r.message ?? 'The payment did not go through. Try again, or use the button below to pay on Square’s secure page.', r.code ?? 'declined');
    } catch {
      fail('Could not reach the payment server. Check your connection and try again, or use the button below.', 'network');
    }
  }

  const squarePage = () => { track('pay_use_square_page', { source: props.source, after: failed ? 'error' : 'choice' }); props.onFallback(); };

  return (
    <div ref={box} class="grid gap-3 rounded-xl border border-rule/50 bg-[#f6f8fc] p-4" role="region" aria-label="Secure card payment">
      {props.onClose && (
        <div class="flex justify-end -mb-1"><button type="button" class="text-[13px] text-muted underline underline-offset-2" onClick={props.onClose}>Cancel</button></div>
      )}
      {wallets.apple && (
        <button type="button" class="w-full rounded-lg disabled:opacity-60" style="-webkit-appearance:-apple-pay-button;-apple-pay-button-type:plain;-apple-pay-button-style:black;height:48px" disabled={state !== 'ready'} onClick={() => pay('apple')} aria-label="Pay with Apple Pay" />
      )}
      <div id={ids.gpay} class={wallets.google ? 'min-h-[48px] cursor-pointer' : 'hidden'} onClick={() => pay('google')} role="button" aria-label="Pay with Google Pay" />
      {(wallets.apple || wallets.google) && <p class="text-center text-[12.5px] text-muted">or pay with a card</p>}
      <div id={ids.card} class="min-h-[90px]">{state === 'loading' && <p class="text-[14px] text-muted">Loading secure card form…</p>}</div>
      {msg && <p class="text-[14px] font-bold text-[#b4232c]" role="alert">{msg}</p>}
      <button type="button" class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60" disabled={state !== 'ready'} onClick={() => pay('card')}>
        {state === 'paying' || state === 'done' ? 'Paying…' : props.buttonText.replace('{total}', money(props.cents))}
      </button>
      {failed > 0 && (
        <button type="button" class="w-full rounded-lg border border-rule bg-white px-4 py-3 text-[15px] font-bold text-ink hover:bg-[#eef4ff]" onClick={squarePage}>Pay on Square’s secure checkout page instead</button>
      )}
      <p class="text-[12.5px] text-muted text-center">Processed by Square. Your card number goes to Square, never to Tracelings.{props.note ? ' ' + props.note : ''}</p>
      {!failed && <button type="button" class="text-[12.5px] text-muted underline underline-offset-2" onClick={squarePage}>Prefer Square’s own checkout page? Open it instead</button>}
    </div>
  );
}
