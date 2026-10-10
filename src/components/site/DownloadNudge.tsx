import { useEffect, useState } from 'preact/hooks';

// A small, dismissible card shown after a successful download, inviting free visitors to membership.
// Never shown to members, never blocks anything, and stays quiet for a day after being closed.
const SNOOZE_KEY = 'tl-nudge-snooze';
const NAME_TOOLS = /^\/(name-tracing|cursive|cursive-name-tracing|name-coloring-pages|class-pack|$)/;

function snoozed(): boolean {
  try { return Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now(); } catch { return false; }
}
function snooze(days: number) {
  try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * 86_400_000)); } catch { /* ignore */ }
}
const track = (name: string) => { try { (window as any).gtag?.('event', name, { tool_page: location.pathname }); } catch { /* ignore */ } };

export default function DownloadNudge() {
  const [show, setShow] = useState(false);
  const [names, setNames] = useState(false);

  useEffect(() => {
    let t: number | undefined;
    const onDownload = () => {
      if ((window as any).__tlMember === true || snoozed()) return;
      clearTimeout(t);
      t = window.setTimeout(() => {
        setNames(NAME_TOOLS.test(location.pathname));
        setShow(true);
        track('member_nudge_shown');
      }, 1200);
    };
    window.addEventListener('tl-downloaded', onDownload);
    return () => { window.removeEventListener('tl-downloaded', onDownload); clearTimeout(t); };
  }, []);

  if (!show) return null;
  const close = () => { setShow(false); snooze(1); track('member_nudge_closed'); };

  return (
    <div class="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[380px] nudge-in" role="status" aria-live="polite">
      <div class="relative rounded-2xl border border-hairline bg-white p-5 shadow-[0_20px_50px_-20px_rgba(30,42,68,.55)]">
        <button type="button" onClick={close} class="absolute right-2.5 top-2.5 inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-[#eef2f8] hover:text-ink" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
        </button>
        <p class="pr-8 text-[13px] font-bold uppercase tracking-wider text-[#1f7a50]">Your PDF is downloading</p>
        {names ? (
          <>
            <p class="mt-2 text-[17px] font-bold leading-snug text-ink">Printing for a whole class?</p>
            <p class="mt-1.5 text-[15px] leading-relaxed text-muted">Members save their class list once and print every child's tracing sheet, cursive sheet and coloring page in one click. No footer line, no email prompts.</p>
          </>
        ) : (
          <>
            <p class="mt-2 text-[17px] font-bold leading-snug text-ink">Print more with a membership</p>
            <p class="mt-1.5 text-[15px] leading-relaxed text-muted">Every printable with no footer line, no email prompts, and a saved class list that prints a page for every child at once.</p>
          </>
        )}
        <div class="mt-4 flex items-center gap-3">
          <a href="/membership/" onClick={() => { snooze(7); track('member_nudge_clicked'); }} class="btn-pencil px-4 py-2.5 text-[15px]">See membership</a>
          <span class="text-[13px] text-muted">From $29 a year</span>
        </div>
      </div>
    </div>
  );
}
