import { useEffect, useState } from 'preact/hooks';
import CoffeeButtons from '../CoffeeButtons';

// A small, dismissible card shown after a successful download, inviting free visitors to membership.
// Never shown to members, never blocks anything, and stays quiet for a day after being closed.
const SNOOZE_KEY = 'tl-nudge-snooze';
// "Buy us a coffee" card: shows from the 4th download on a device, then rests for 3 weeks after it's closed.
// Never shown again once someone has tipped (the thank-you page sets COFFEE_DONE).
const COFFEE_AFTER = 4;
const COFFEE_SNOOZE = 'tl-coffee-snooze';
export const COFFEE_DONE = 'tl-coffee-done';
function coffeeDue(): boolean {
  try {
    if (localStorage.getItem(COFFEE_DONE)) return false;
    if (Number(localStorage.getItem(COFFEE_SNOOZE) || 0) > Date.now()) return false;
    return Number(localStorage.getItem('tl-downloads') || 0) >= COFFEE_AFTER;
  } catch { return false; }
}
function snoozeCoffee(days: number) {
  try { localStorage.setItem(COFFEE_SNOOZE, String(Date.now() + days * 86_400_000)); } catch { /* ignore */ }
}
const NAME_TOOLS = /^\/(name-tracing|cursive|cursive-name-tracing|name-coloring-pages|class-pack|$)/;
// Pages where the free-week program offer replaces the coffee card: the visitor is already doing school-style work.
export const PROGRAM_PAGES = /^\/(homeschool|math-worksheets|word-families|sight-words|letter-of-the-week)(\/|$)/;
const PROGRAM_SNOOZE = 'tl-program-snooze';
function programSnoozed(): boolean {
  try { return Number(localStorage.getItem(PROGRAM_SNOOZE) || 0) > Date.now(); } catch { return false; }
}
function snoozeProgram(days: number) {
  try { localStorage.setItem(PROGRAM_SNOOZE, String(Date.now() + days * 86_400_000)); } catch { /* ignore */ }
}

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
  const [coffee, setCoffee] = useState(false);
  const [program, setProgram] = useState(false);

  useEffect(() => {
    let t: number | undefined;
    const onDownload = () => {
      if ((window as any).__tlMember === true) return;
      if (PROGRAM_PAGES.test(location.pathname)) {
        // Program offer first on school-style pages; coffee stays on the other tools.
        if (programSnoozed()) return;
        clearTimeout(t);
        t = window.setTimeout(() => { setCoffee(false); setProgram(true); setShow(true); track('program_nudge_shown'); }, 1200);
        return;
      }
      const wantCoffee = coffeeDue();
      if (!wantCoffee && snoozed()) return;
      clearTimeout(t);
      t = window.setTimeout(() => {
        setCoffee(wantCoffee);
        if (wantCoffee) { snoozeCoffee(21); setShow(true); track('coffee_prompt_shown'); return; }
        setNames(NAME_TOOLS.test(location.pathname));
        setShow(true);
        track('member_nudge_shown');
      }, 1200);
    };
    window.addEventListener('tl-downloaded', onDownload);
    return () => { window.removeEventListener('tl-downloaded', onDownload); clearTimeout(t); };
  }, []);

  if (!show) return null;
  if (program) {
    const closeProgram = () => { setShow(false); snoozeProgram(3); track('program_nudge_closed'); };
    return (
      <div class="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[400px] nudge-in" role="status" aria-live="polite">
        <div class="relative rounded-2xl border border-hairline bg-white p-5 shadow-[0_20px_50px_-20px_rgba(30,42,68,.55)]">
          <button type="button" onClick={closeProgram} class="absolute right-2.5 top-2.5 inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-[#eef2f8] hover:text-ink" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
          </button>
          <p class="pr-8 text-[13px] font-bold uppercase tracking-wider text-[#1f7a50]">Your PDF is downloading</p>
          <div class="mt-3 flex gap-3.5">
            <img src="/program/scenes/dinosaurs/find-egg-thumb.webp" alt="A picture book page: a little T-rex finds a spotted egg" width="480" height="360" class="h-[66px] w-[88px] shrink-0 rounded-md border border-hairline object-cover" />
            <div class="min-w-0">
              <p class="text-[17px] font-bold leading-snug text-ink">Get a week built around your child, free</p>
              <p class="mt-1 text-[14px] leading-snug text-muted">At their level, themed on what they love, with a picture book starring them.</p>
            </div>
          </div>
          <div class="mt-4 flex items-center gap-3">
            <a href="/program/" onClick={() => { snoozeProgram(7); track('program_nudge_clicked'); }} class="btn-pencil px-4 py-2.5 text-[15px]">Build my free week</a>
            <button type="button" onClick={closeProgram} class="text-[13px] text-muted underline underline-offset-2">Maybe later</button>
          </div>
        </div>
      </div>
    );
  }
  if (coffee) {
    const closeCoffee = () => { setShow(false); track('coffee_prompt_closed'); };
    return (
      <div class="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[380px] nudge-in" role="status" aria-live="polite">
        <div class="relative rounded-2xl border border-hairline bg-white p-5 shadow-[0_20px_50px_-20px_rgba(30,42,68,.55)]">
          <button type="button" onClick={closeCoffee} class="absolute right-2.5 top-2.5 inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-[#eef2f8] hover:text-ink" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
          </button>
          <p class="pr-8 text-[13px] font-bold uppercase tracking-wider text-[#1f7a50]">Your PDF is downloading</p>
          <p class="mt-2 text-[17px] font-bold leading-snug text-ink">Enjoying the free printables?</p>
          <p class="mt-1.5 text-[15px] leading-relaxed text-muted">Tracelings is free for every family, and we want to keep it that way while we build more homeschool weeks and worksheets. If it's helped you, you can buy us a coffee.</p>
          <div class="mt-4"><CoffeeButtons source="download-card" /></div>
          <button type="button" onClick={closeCoffee} class="mt-2 text-[13px] text-muted underline underline-offset-2">Maybe later</button>
        </div>
      </div>
    );
  }
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
            <p class="mt-2 text-[17px] font-bold leading-snug text-ink">Teaching at home?</p>
            <p class="mt-1.5 text-[15px] leading-relaxed text-muted">Get a weekly plan built for each of your kids, themed on what they love, with a new story starring them every week.</p>
          </>
        ) : (
          <>
            <p class="mt-2 text-[17px] font-bold leading-snug text-ink">A plan built for your child</p>
            <p class="mt-1.5 text-[15px] leading-relaxed text-muted">Weekly packs at their level, themed on what they love, with a new story starring them every week. Week 1 is free.</p>
          </>
        )}
        <p class="mt-3 text-[14px] font-bold leading-snug text-[#1f7a50]">Members keep Tracelings free for every family.</p>
        <div class="mt-4 flex items-center gap-3">
          <a href="/membership/" onClick={() => { snooze(7); track('member_nudge_clicked'); }} class="btn-pencil px-4 py-2.5 text-[15px]">See the program</a>
          <span class="text-[13px] text-muted">From $8.25 a month</span>
        </div>
      </div>
    </div>
  );
}
