import { useMemo, useState } from 'preact/hooks';
import { buildFlashCards, CARDS_PER_PAGE } from '../lib/flashcards';
import { pageToSvg } from '../lib/render';
import { savePdf } from '../lib/download';
import { needsEmail } from '../lib/gate';
import type { Paper } from '../lib/sheet';
import EmailGate from './EmailGate';
import WordChips from './WordChips';
import { Segmented, wordCase } from './Tracer';
import { useMember } from '../lib/member';

// Printable sight word flash cards: 8 per page, cut along the dashed lines.
export default function FlashCards(props: { words: string[]; slug: string; label: string; source?: string }) {
  const [which, setWhich] = useState<'all' | 'some'>('all');
  const [chosen, setChosen] = useState<string[]>(() => props.words.slice(0, 8));
  const [paper, setPaper] = useState<Paper>('letter');
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const member = useMember();
  const credit = !member.member;

  const list = (which === 'all' ? props.words : chosen).map(wordCase);
  const pageCount = Math.max(1, Math.ceil(list.length / CARDS_PER_PAGE));
  const preview = useMemo(
    () => pageToSvg(buildFlashCards({ words: list.slice(0, CARDS_PER_PAGE), paper, label: props.label, credit })[0]).replace('aria-label="Worksheet preview"', 'aria-label="Flash card preview"'),
    [list.join('|'), paper, props.label, credit],
  );

  async function save() {
    setBusy(true);
    setError(false);
    try {
      await savePdf(buildFlashCards({ words: list, paper, label: props.label, credit }), `${props.slug}-sight-word-flash-cards.pdf`, `${props.label} sight word flash cards`);
      setDone(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  function requestDownload(e: Event) {
    e.preventDefault();
    if (!list.length) return;
    if (!member.member && needsEmail()) setGate(true);
    else save();
  }

  return (
    <div class="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <form class="rounded-xl border border-hairline bg-[#eef2f8] p-5 sm:p-6" onSubmit={requestDownload}>
        <Segmented
          legend="Cards"
          name="fc-which"
          value={which}
          onChange={(v) => { setWhich(v); setDone(false); }}
          options={[
            { v: 'all', label: 'All words', sub: `${props.words.length} cards` },
            { v: 'some', label: 'Choose words', sub: `${chosen.length} cards` },
          ]}
        />
        {which === 'some' && (
          <WordChips legend="Words to print" words={props.words} selected={chosen} onChange={(next) => { setChosen(next); setDone(false); }} />
        )}
        <Segmented legend="Paper" name="fc-paper" value={paper} onChange={setPaper} options={[{ v: 'letter', label: 'US Letter' }, { v: 'a4', label: 'A4' }]} />

        {!list.length && <p class="mb-3 text-[14px] text-[#b4232c]" role="alert">Choose at least one word to make cards.</p>}
        <button type="submit" disabled={busy || !list.length} class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60">
          {busy ? 'Making your PDF…' : `Download ${list.length} flash card${list.length === 1 ? '' : 's'}`}
        </button>
        <p class="mt-3 text-[13px] text-muted">{pageCount} page{pageCount === 1 ? '' : 's'}, 8 cards per page. Print on card stock if you have it, then cut on the dashed lines.</p>
        {done && <p class="mt-3 text-[14px] text-[#1f7a50]" role="status">Downloaded. Check your downloads folder, then print at 100% size.</p>}
        {error && <p class="mt-3 text-[14px] text-[#b4232c]" role="alert">The download didn't work. Refresh the page and try again.</p>}
      </form>

      <figure>
        <div class="sheet-frame overflow-hidden max-w-[520px]" dangerouslySetInnerHTML={{ __html: preview }} />
        <figcaption class="mt-3 text-[13px] text-muted">Preview of page 1{pageCount > 1 ? ` of ${pageCount}` : ''}.</figcaption>
      </figure>

      <EmailGate open={gate} source={props.source ?? 'sight-words'} onClose={() => setGate(false)} onDone={() => { setGate(false); save(); }} />
    </div>
  );
}
