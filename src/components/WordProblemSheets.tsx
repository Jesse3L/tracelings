import { useEffect, useMemo, useState } from 'preact/hooks';
import { useHydrated } from '../lib/hydrated';
import { nameNote, toLatin, type Page, type Paper } from '../lib/sheet';
import { pageToSvg } from '../lib/render';
import { savePdf } from '../lib/download';
import { needsEmail } from '../lib/gate';
import { useMember } from '../lib/member';
import { useRoster } from '../lib/roster';
import { loadThemeIcons } from '../lib/program/themes';
import type { ThemeId } from '../lib/program/types';
import { WP_KINDS, WP_THEMES, buildWordProblemPage, buildWordProblemSet, type WPKind, type WPRange } from '../lib/wordProblems';
import { Segmented } from './Tracer';
import EmailGate from './EmailGate';

const link = 'text-[#2f5fc4] underline underline-offset-2';
const SET = 5;

/**
 * Kindergarten word problem maker (/math-worksheets/kindergarten-word-problems/). Free: every type, theme and range,
 * one page at a time, with new problems whenever you like. Members also print five different pages at once, or one
 * page for every kid on their saved list. The child's name goes into the problems and stays in the browser.
 */
export default function WordProblemSheets(props: { source?: string }) {
  const [kind, setKind] = useState<WPKind>('wp-add');
  const [range, setRange] = useState<WPRange>(5);
  const [theme, setTheme] = useState<ThemeId>('farm');
  const [name, setName] = useState('');
  const [paper, setPaper] = useState<Paper>('letter');
  const [seed, setSeed] = useState(1);
  const [icons, setIcons] = useState(0); // bumps when a theme's pictures finish loading
  const [busy, setBusy] = useState(false);
  const ready = useHydrated();
  const [gate, setGate] = useState<null | 'one' | 'set' | 'list'>(null);
  const [done, setDone] = useState('');
  const member = useMember();
  const [roster] = useRoster();
  const credit = !member.member;

  useEffect(() => {
    try {
      const q = new URLSearchParams(location.search);
      const k = q.get('type') as WPKind | null;
      if (k && WP_KINDS.some((x) => x.v === k)) setKind(k);
      const r = Number(q.get('range'));
      if (r === 5 || r === 10) setRange(r);
      const t = q.get('theme') as ThemeId | null;
      if (t && WP_THEMES.some((x) => x.v === t)) setTheme(t);
      const nm = sessionStorage.getItem('tl-name');
      if (nm) setName(nm);
    } catch { /* storage or URL unavailable */ }
  }, []);
  // Keep the typed name for the other tools in this tab (never in the URL, never sent anywhere).
  useEffect(() => { try { if (name) sessionStorage.setItem('tl-name', name); } catch { /* ignore */ } }, [name]);
  useEffect(() => { loadThemeIcons([theme]).then(() => setIcons((n) => n + 1)); }, [theme]);
  useEffect(() => setDone(''), [kind, range, theme]);

  const opts = { kind, range, theme, name, paper, credit, seed };
  const page = useMemo(() => buildWordProblemPage(opts), [kind, range, theme, name, paper, credit, seed, icons]);
  const svg = useMemo(() => pageToSvg(page), [page]);
  const listNames = member.member ? roster.slice(0, member.maxNames ?? 8) : [];
  const kindLabel = WP_KINDS.find((x) => x.v === kind)!.label;
  const themeLabel = WP_THEMES.find((x) => x.v === theme)!.label;
  const slug = (s: string) => toLatin(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const base = `kindergarten-${slug(kindLabel)}-${theme}-within-${range}`;

  async function save(k: 'one' | 'set' | 'list') {
    setBusy(true);
    try {
      await loadThemeIcons([theme]);
      let pages: Page[];
      let file: string;
      if (k === 'list') {
        pages = listNames.map((n) => buildWordProblemPage({ ...opts, name: n }));
        file = `${base}-${listNames.length}-kids.pdf`;
      } else if (k === 'set') {
        pages = buildWordProblemSet(opts, SET);
        file = `${base}-${SET}-pages.pdf`;
      } else {
        pages = [buildWordProblemPage(opts)];
        const who = slug(name);
        file = `${who ? `${who}-` : ''}${base}.pdf`;
      }
      await savePdf(pages, file, `Kindergarten word problems: ${kindLabel}`);
      setDone(k === 'one' ? 'Downloaded. Print at 100% size. Tap "New problems" any time for a fresh page.' : `Downloaded ${pages.length} pages.`);
    } finally {
      setBusy(false);
    }
  }
  const ask = (k: 'one' | 'set' | 'list') => (!member.member && needsEmail() ? setGate(k) : save(k));

  return (
    <div class="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <form class="rounded-xl border border-hairline bg-[#eef2f8] p-5 sm:p-6" onSubmit={(e) => { e.preventDefault(); ask('one'); }}>
        <fieldset class="mb-5">
          <legend class="text-[15px] font-bold mb-2">Worksheet</legend>
          <div class="grid gap-2">
            {WP_KINDS.map((o) => {
              const on = o.v === kind;
              return (
                <label class={`cursor-pointer rounded-lg border px-3 py-2 text-[15px] leading-tight transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-rule ${on ? 'border-rule bg-white text-ink shadow-[inset_0_0_0_1px_var(--color-rule)]' : 'border-hairline bg-white/60 text-muted hover:text-ink'}`}>
                  <input type="radio" class="sr-only" name="wp-kind" checked={on} onChange={() => setKind(o.v)} />
                  <span class="block font-bold">{o.label}</span>
                  <span class="block text-[13px] text-muted mt-0.5">{o.sub}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <label class="block mb-5">
          <span class="block text-[15px] font-bold mb-2">Pictures and stories about</span>
          <select id="wp-theme" value={theme} onChange={(e) => setTheme((e.target as HTMLSelectElement).value as ThemeId)}
            class="w-full rounded-lg border border-hairline bg-white px-4 py-3 text-lg text-ink focus:border-rule focus:outline-none">
            {WP_THEMES.map((t) => <option value={t.v}>{t.label}</option>)}
          </select>
        </label>

        <Segmented legend="Numbers" name="wp-range" value={String(range) as '5' | '10'} onChange={(v) => setRange(Number(v) as WPRange)} options={[
          { v: '5', label: 'Within 5', sub: 'just starting' },
          { v: '10', label: 'Within 10', sub: 'most of K' },
        ]} />

        <label class="block mb-5">
          <span class="block text-[15px] font-bold mb-2">Child's first name <span class="font-normal text-muted">(optional)</span></span>
          <input id="wp-name" type="text" value={name} maxLength={24} autoComplete="off" spellcheck={false} placeholder="Type a name"
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            class="w-full rounded-lg border border-hairline bg-white px-4 py-3 text-xl text-ink placeholder:text-[#a3acbf] focus:border-rule focus:outline-none" />
          <span class="block text-[13px] text-muted mt-2">Printed on the Name line and in the stories. It stays on this device.</span>
          {nameNote(name) && <span class="block text-[13px] text-[#b4232c] mt-1" role="status">{nameNote(name)}</span>}
        </label>

        <Segmented legend="Paper" name="wp-paper" value={paper} onChange={setPaper} options={[{ v: 'letter', label: 'US Letter' }, { v: 'a4', label: 'A4' }]} />

        <button type="button" onClick={() => setSeed((s) => s + 1)} class="mb-3 w-full rounded-lg border border-rule bg-white px-5 py-2.5 text-[16px] font-bold text-ink">
          New problems
        </button>
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
                  {SET} different pages in one PDF
                </button>
                <button type="button" disabled={busy || listNames.length === 0} onClick={() => save('list')} class="rounded-lg border border-rule bg-white px-4 py-2.5 text-left text-[15px] font-bold text-ink disabled:opacity-50">
                  {listNames.length ? `This page for all ${listNames.length} kids` : 'This page for every kid on your list'}
                </button>
              </div>
              {listNames.length === 0 && <p class="mt-2">Save your kids' names once in <a class={link} href="/name-tracing/">name tracing</a> and they show up here.</p>}
            </>
          ) : (
            <>
              <span class="font-bold text-ink">Want a week of word problems at once?</span> Members print five different pages in one PDF, or one for every kid, with no footer line.{' '}
              <a href="/membership/" class={link}>See membership</a>
            </>
          )}
        </div>
      </form>

      <figure class="lg:sticky lg:top-20">
        <div class="sheet-frame overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />
        <figcaption class="mt-3 text-[13px] text-muted">{kindLabel}, {themeLabel.toLowerCase()}, within {range}. This is exactly what prints.</figcaption>
      </figure>

      <EmailGate open={gate !== null} source={props.source ?? 'kindergarten-word-problems'} onClose={() => setGate(null)} onDone={() => { const k = gate ?? 'one'; setGate(null); save(k); }} />
    </div>
  );
}
