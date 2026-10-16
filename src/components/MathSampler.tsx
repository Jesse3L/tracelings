import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Page, Paper } from '../lib/sheet';
import { pageToSvg } from '../lib/render';
import { savePdf } from '../lib/download';
import { needsEmail } from '../lib/gate';
import { useMember } from '../lib/member';
import { buildMathPage, type MathOptions } from '../lib/mathSheets';
import { Segmented } from './Tracer';
import EmailGate from './EmailGate';

/** The pages in the free kindergarten math sampler, one from each maker, roughly in the order the year goes. */
export const SAMPLER: { label: string; o: Omit<MathOptions, 'name' | 'paper' | 'credit' | 'seed'> }[] = [
  { label: 'Ten frames: how many? (11 to 20)', o: { kind: 'ten-frame', range: 20, number: 5, compare: 'more', series: 'ten-frames' } },
  { label: 'Missing numbers 1 to 20', o: { kind: 'missing', range: 20, number: 5, compare: 'more', series: 'pre-k' } },
  { label: 'Compare numbers 1 to 10', o: { kind: 'compare-numbers', range: 10, number: 5, compare: 'more', series: 'more-less' } },
  { label: 'Make 10', o: { kind: 'make-ten', range: 10, number: 5, compare: 'more', series: 'ten-frames' } },
  { label: 'Picture addition within 10', o: { kind: 'add-pictures', range: 10, number: 5, compare: 'more', series: 'k-addition' } },
  { label: 'Subtraction with pictures within 10', o: { kind: 'subtract-pictures', range: 10, number: 5, compare: 'more', series: 'k-addition' } },
];

/** Free kindergarten math sampler: six different pages in one PDF, for everyone. */
export default function MathSampler(props: { source?: string }) {
  const [name, setName] = useState('');
  const [paper, setPaper] = useState<Paper>('letter');
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [done, setDone] = useState('');
  const member = useMember();
  const credit = !member.member;

  useEffect(() => {
    try { const nm = sessionStorage.getItem('tl-name'); if (nm) setName(nm); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => { try { if (name) sessionStorage.setItem('tl-name', name); } catch { /* ignore */ } }, [name]);

  const build = (): Page[] => SAMPLER.map((s, i) => buildMathPage({ ...s.o, name, paper, credit, seed: 1 + i }));
  const first = useMemo(() => pageToSvg(buildMathPage({ ...SAMPLER[4].o, name, paper, credit, seed: 5 })), [name, paper, credit]);

  async function save() {
    setBusy(true);
    try {
      const who = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await savePdf(build(), `${who ? `${who}-` : ''}kindergarten-math-sampler.pdf`, 'Kindergarten math sampler');
      setDone(`Downloaded ${SAMPLER.length} pages. Print at 100% size.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)] items-start rounded-xl border border-hairline bg-[#eef2f8] p-5 sm:p-6">
      <form onSubmit={(e) => { e.preventDefault(); !member.member && needsEmail() ? setGate(true) : save(); }}>
        <p class="text-[15px] font-bold mb-2">What's in the sampler</p>
        <ol class="mb-5 list-decimal pl-5 text-[15px] leading-relaxed text-ink">
          {SAMPLER.map((s) => <li>{s.label}</li>)}
        </ol>
        <label class="block mb-5">
          <span class="block text-[15px] font-bold mb-2">Child's first name <span class="font-normal text-muted">(optional)</span></span>
          <input id="sampler-name" type="text" value={name} maxLength={24} autoComplete="off" spellcheck={false} placeholder="Type a name"
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            class="w-full rounded-lg border border-hairline bg-white px-4 py-3 text-xl text-ink placeholder:text-[#a3acbf] focus:border-rule focus:outline-none" />
          <span class="block text-[13px] text-muted mt-2">Printed on every page. It stays on this device.</span>
        </label>
        <Segmented legend="Paper" name="sampler-paper" value={paper} onChange={setPaper} options={[{ v: 'letter', label: 'US Letter' }, { v: 'a4', label: 'A4' }]} />
        <button type="submit" disabled={busy} class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60">
          {busy ? 'Making your PDF…' : `Download the free sampler (${SAMPLER.length} pages)`}
        </button>
        {done && <p class="mt-4 text-[14px] text-[#1f7a50]" role="status">{done}</p>}
      </form>
      <figure>
        <div class="sheet-frame overflow-hidden" dangerouslySetInnerHTML={{ __html: first }} />
        <figcaption class="mt-2 text-[13px] text-muted">Page 5 of the sampler: picture addition.</figcaption>
      </figure>
      <EmailGate open={gate} source={props.source ?? 'k-math-sampler'} onClose={() => setGate(false)} onDone={() => { setGate(false); save(); }} />
    </div>
  );
}
