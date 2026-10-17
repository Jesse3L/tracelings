import { useEffect, useMemo, useState } from 'preact/hooks';
import { useHydrated } from '../lib/hydrated';
import { nameNote, toLatin, type Page, type Paper } from '../lib/sheet';
import { pageToSvg } from '../lib/render';
import { savePdf } from '../lib/download';
import { needsEmail } from '../lib/gate';
import { useMember } from '../lib/member';
import { useRoster } from '../lib/roster';
import { FAMILY_KINDS, FAMILY_INFO, buildFamilyPage, buildFamilySet, partnerOf, type FamilyKind } from '../lib/wordFamilies';
import { Segmented } from './Tracer';
import EmailGate from './EmailGate';

const link = 'text-[#2f5fc4] underline underline-offset-2';

/**
 * Word family worksheet maker, used on /word-families/ and each /word-families/<family>/ page.
 * Free: every family and page type, one page at a time. Members also print all six pages for a family in one PDF,
 * or this page for every kid on their saved list. The child's name stays in the browser.
 */
export default function WordFamilySheets(props: { family?: string; source?: string; pickFamily?: boolean }) {
  const [family, setFamily] = useState(props.family ?? 'at');
  const [kind, setKind] = useState<FamilyKind>('hunt');
  const [name, setName] = useState('');
  const [paper, setPaper] = useState<Paper>('letter');
  const [seed, setSeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const ready = useHydrated();
  const [gate, setGate] = useState<null | 'one' | 'set' | 'list'>(null);
  const [done, setDone] = useState('');
  const member = useMember();
  const [roster] = useRoster();
  const credit = !member.member;
  const source = props.source ?? 'word-families';

  useEffect(() => {
    try {
      const q = new URLSearchParams(location.search);
      const k = q.get('type') as FamilyKind | null;
      if (k && FAMILY_KINDS.some((x) => x.v === k)) setKind(k);
      const f = q.get('family');
      if (props.pickFamily && f && FAMILY_INFO.some((x) => x.slug === f)) setFamily(f);
      const nm = sessionStorage.getItem('tl-name');
      if (nm) setName(nm);
    } catch { /* storage or URL unavailable */ }
  }, []);
  // Keep the typed name for the other tools in this tab (never in the URL, never sent anywhere).
  useEffect(() => { try { if (name) sessionStorage.setItem('tl-name', name); } catch { /* ignore */ } }, [name]);
  useEffect(() => setDone(''), [kind, family]);

  const opts = { family, kind, name, paper, credit, seed };
  const page = useMemo(() => buildFamilyPage(opts), [family, kind, name, paper, credit, seed]);
  const svg = useMemo(() => pageToSvg(page), [page]);
  const listNames = member.member ? roster.slice(0, member.maxNames ?? 8) : [];
  const kindLabel = FAMILY_KINDS.find((x) => x.v === kind)!.label;
  const random = kind === 'hunt' || kind === 'sort';
  const slug = (s: string) => toLatin(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  async function save(k: 'one' | 'set' | 'list') {
    setBusy(true);
    try {
      let pages: Page[];
      let file: string;
      if (k === 'list') {
        pages = listNames.map((n) => buildFamilyPage({ ...opts, name: n }));
        file = `${family}-word-family-${slug(kindLabel)}-${listNames.length}-kids.pdf`;
      } else if (k === 'set') {
        pages = buildFamilySet(opts);
        file = `${family}-word-family-worksheets.pdf`;
      } else {
        pages = [page];
        const who = slug(name);
        file = `${who ? `${who}-` : ''}${family}-word-family-${slug(kindLabel)}.pdf`;
      }
      await savePdf(pages, file, `Word family -${family}: ${k === 'set' ? 'worksheets' : kindLabel.toLowerCase()}`);
      setDone(k === 'one' ? (random ? 'Downloaded. Print at 100% size. Tap "New words" for a fresh mix.' : 'Downloaded. Print at 100% size.') : `Downloaded ${pages.length} pages.`);
    } finally {
      setBusy(false);
    }
  }
  const ask = (k: 'one' | 'set' | 'list') => (!member.member && needsEmail() ? setGate(k) : save(k));

  return (
    <div class="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <form class="rounded-xl border border-hairline bg-[#eef2f8] p-5 sm:p-6" onSubmit={(e) => { e.preventDefault(); ask('one'); }}>
        {props.pickFamily && (
          <label class="block mb-5">
            <span class="block text-[15px] font-bold mb-2">Word family</span>
            <select id="wf-family" value={family} onChange={(e) => setFamily((e.target as HTMLSelectElement).value)}
              class="w-full rounded-lg border border-hairline bg-white px-4 py-3 text-lg text-ink focus:border-rule focus:outline-none">
              {FAMILY_INFO.map((f) => <option value={f.slug}>-{f.slug} ({f.words.slice(0, 3).join(', ')})</option>)}
            </select>
          </label>
        )}
        <fieldset class="mb-5">
          <legend class="text-[15px] font-bold mb-2">Worksheet</legend>
          <div class="grid gap-2">
            {FAMILY_KINDS.map((o) => {
              const on = o.v === kind;
              return (
                <label class={`cursor-pointer rounded-lg border px-3 py-2 text-[15px] leading-tight transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-rule ${on ? 'border-rule bg-white text-ink shadow-[inset_0_0_0_1px_var(--color-rule)]' : 'border-hairline bg-white/60 text-muted hover:text-ink'}`}>
                  <input type="radio" class="sr-only" name="wf-kind" checked={on} onChange={() => setKind(o.v)} />
                  <span class="block font-bold">{o.label}</span>
                  <span class="block text-[13px] text-muted mt-0.5">{o.v === 'sort' ? `-${family} or -${partnerOf(family)}: write each word in its column` : o.sub}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <label class="block mb-5">
          <span class="block text-[15px] font-bold mb-2">Child's first name <span class="font-normal text-muted">(optional)</span></span>
          <input id="wf-name" type="text" value={name} maxLength={24} autoComplete="off" spellcheck={false} placeholder="Type a name"
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            class="w-full rounded-lg border border-hairline bg-white px-4 py-3 text-xl text-ink placeholder:text-[#a3acbf] focus:border-rule focus:outline-none" />
          <span class="block text-[13px] text-muted mt-2">Printed on the Name line. It stays on this device.</span>
          {nameNote(name) && <span class="block text-[13px] text-[#b4232c] mt-1" role="status">{nameNote(name)}</span>}
        </label>

        <Segmented legend="Paper" name="wf-paper" value={paper} onChange={setPaper} options={[{ v: 'letter', label: 'US Letter' }, { v: 'a4', label: 'A4' }]} />

        {random && (
          <button type="button" onClick={() => setSeed((s) => s + 1)} class="mb-3 w-full rounded-lg border border-rule bg-white px-5 py-2.5 text-[16px] font-bold text-ink">
            New words
          </button>
        )}
        <button type="submit" disabled={!ready || busy} class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60">
          {!ready ? 'Loading…' : busy ? 'Making your PDF…' : 'Download this worksheet'}
        </button>
        {done && <p class="mt-4 text-[14px] text-[#1f7a50]" role="status">{done}</p>}

        <div class="mt-5 rounded-lg border border-dashed border-rule/60 bg-white/70 p-4 text-[14px] leading-snug text-muted">
          {member.member ? (
            <>
              <p class="font-bold text-ink">Member printing</p>
              <div class="mt-3 grid gap-2">
                <button type="button" disabled={busy} onClick={() => save('set')} class="rounded-lg border border-rule bg-white px-4 py-2.5 text-left text-[15px] font-bold text-ink disabled:opacity-50">
                  All {FAMILY_KINDS.length} -{family} pages in one PDF
                </button>
                <button type="button" disabled={busy || listNames.length === 0} onClick={() => save('list')} class="rounded-lg border border-rule bg-white px-4 py-2.5 text-left text-[15px] font-bold text-ink disabled:opacity-50">
                  {listNames.length ? `This page for all ${listNames.length} kids` : 'This page for every kid on your list'}
                </button>
              </div>
              {listNames.length === 0 && <p class="mt-2">Save your kids' names once in <a class={link} href="/name-tracing/">name tracing</a> and they show up here.</p>}
            </>
          ) : (
            <>
              <span class="font-bold text-ink">Want the whole family at once?</span> Members print all six -{family} pages in one PDF, or one page for every kid, with no footer line.{' '}
              <a href="/membership/" class={link}>See membership</a>
            </>
          )}
        </div>
      </form>

      <figure class="lg:sticky lg:top-20">
        <div class="sheet-frame overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />
        <figcaption class="mt-3 text-[13px] text-muted">-{family} word family: {kindLabel.toLowerCase()}. This is exactly what prints.</figcaption>
      </figure>

      <EmailGate open={gate !== null} source={source} onClose={() => setGate(null)} onDone={() => { const k = gate ?? 'one'; setGate(null); save(k); }} />
    </div>
  );
}
