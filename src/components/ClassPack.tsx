import { useEffect, useMemo, useState } from 'preact/hooks';
import { buildSheet, type LetterStyle, type LineSize, type Page, type Paper } from '../lib/sheet';
import { pageToSvg } from '../lib/render';
import { loadFont, type LoadedFont } from '../lib/fontshape';
import { buildCursiveSheet } from '../lib/cursive';
import { buildColoringPage, type Theme } from '../lib/coloring';
import { savePdf } from '../lib/download';
import { useMember } from '../lib/member';
import { useRoster } from '../lib/roster';
import RosterPanel from './RosterPanel';
import { Segmented } from './Tracer';

const link = 'text-[#2f5fc4] underline underline-offset-2';

function Check(props: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; sub: string }) {
  return (
    <label class="flex items-start gap-3 cursor-pointer rounded-lg border border-hairline bg-white px-3 py-2.5">
      <input id={props.id} type="checkbox" class="mt-1 size-4 accent-[#5b86d9]" checked={props.checked} onChange={(e) => props.onChange((e.target as HTMLInputElement).checked)} />
      <span><span class="block font-bold text-ink text-[15px]">{props.label}</span><span class="block text-[13px] text-muted">{props.sub}</span></span>
    </label>
  );
}

/** One PDF with every child's printables: name tracing, cursive and a name coloring page. Members only. */
export default function ClassPack() {
  const member = useMember();
  const [roster] = useRoster();
  const [useList, setUseList] = useState(true);
  const [tracing, setTracing] = useState(true);
  const [cursive, setCursive] = useState(true);
  const [coloring, setColoring] = useState(true);
  const [style, setStyle] = useState<LetterStyle>('capital');
  const [size, setSize] = useState<LineSize>('large');
  const [theme, setTheme] = useState<Theme>('stars');
  const [paper, setPaper] = useState<Paper>('letter');
  const [order, setOrder] = useState<'child' | 'activity'>('child');
  const [fonts, setFonts] = useState<{ cursive?: LoadedFont; bubble?: LoadedFont }>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  const names = useList ? roster.slice(0, member.maxNames ?? 8) : [];
  const kinds = [tracing && 'tracing', cursive && 'cursive', coloring && 'coloring'].filter(Boolean) as ('tracing' | 'cursive' | 'coloring')[];

  useEffect(() => {
    if (!member.member) return;
    if (cursive && !fonts.cursive) loadFont('cursive').then((f) => setFonts((x) => ({ ...x, cursive: f }))).catch(() => setError(true));
    if (coloring && !fonts.bubble) loadFont('bubble').then((f) => setFonts((x) => ({ ...x, bubble: f }))).catch(() => setError(true));
  }, [member.member, cursive, coloring]);

  const ready = (!cursive || fonts.cursive) && (!coloring || fonts.bubble);

  function pageFor(kind: 'tracing' | 'cursive' | 'coloring', name: string): Page | null {
    if (kind === 'tracing') return buildSheet({ name, style, size, paper, practice: 'trace-write', startDots: true, modelRow: true, credit: false });
    if (kind === 'cursive') return fonts.cursive ? buildCursiveSheet(fonts.cursive, { text: name, size, paper, practice: 'trace-write', modelRow: true, credit: false }) : null;
    return fonts.bubble ? buildColoringPage(fonts.bubble, { name: name.slice(0, 16), theme, paper, caps: style === 'caps', credit: false }) : null;
  }

  const previews = useMemo(() => {
    const first = names[0] ?? 'Ava';
    return kinds.map((k) => { const p = pageFor(k, first); return p ? pageToSvg(p) : ''; });
  }, [names[0], kinds.join(), style, size, theme, paper, fonts]);

  async function download() {
    if (!names.length || !kinds.length || !ready) return;
    setBusy(true); setDone(false); setError(false);
    try {
      const pages: Page[] = [];
      if (order === 'child') for (const n of names) for (const k of kinds) pages.push(pageFor(k, n)!);
      else for (const k of kinds) for (const n of names) pages.push(pageFor(k, n)!);
      await savePdf(pages, 'class-pack.pdf', 'Class pack: name tracing, cursive and coloring');
      setDone(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (!member.loaded) return <div class="rounded-xl border border-hairline bg-white p-6 text-muted">Loading…</div>;

  if (!member.member) {
    return (
      <div class="rounded-xl border border-hairline bg-white p-6 max-w-xl">
        <p class="font-bold text-lg text-ink">Class packs are a member feature.</p>
        <p class="mt-2 text-muted leading-relaxed">Paste your class list once, then download a name tracing sheet, a cursive sheet and a name coloring page for every child in one PDF. Already a member? <a href="/account/" class={link}>Sign in</a> on this browser.</p>
        <a href="/membership/" class="btn-pencil mt-4 inline-block px-5 py-3 text-lg">See membership</a>
      </div>
    );
  }

  const total = names.length * kinds.length;
  return (
    <div class="grid gap-8 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] items-start">
      <form class="rounded-xl border border-hairline bg-[#eef2f8] p-5 sm:p-6" onSubmit={(e) => { e.preventDefault(); download(); }}>
        <RosterPanel use={useList} onUse={setUseList} maxNames={member.maxNames ?? 8} what="a pack" />

        <fieldset class="mb-5">
          <legend class="text-[15px] font-bold mb-2">In each child's pack</legend>
          <div class="grid gap-2">
            <Check id="cp-tracing" checked={tracing} onChange={setTracing} label="Name tracing sheet" sub="Dotted letters with starting dots" />
            <Check id="cp-cursive" checked={cursive} onChange={setCursive} label="Cursive name sheet" sub="Connected letters to trace" />
            <Check id="cp-coloring" checked={coloring} onChange={setColoring} label="Name coloring page" sub="Big bubble letters to color" />
          </div>
        </fieldset>

        <Segmented legend="Letter style" name="cp-style" value={style} onChange={setStyle} options={[
          { v: 'capital', label: 'Capital first', sub: 'Emma' }, { v: 'caps', label: 'ALL CAPS', sub: 'EMMA' }, { v: 'lower', label: 'lowercase', sub: 'emma' },
        ]} />
        <Segmented legend="Line size" name="cp-size" value={size} onChange={setSize} options={[
          { v: 'large', label: 'Large', sub: 'ages 3–4' }, { v: 'medium', label: 'Medium', sub: 'ages 5–6' }, { v: 'small', label: 'Small', sub: 'ages 6+' },
        ]} />
        {coloring && (
          <Segmented legend="Coloring page shapes" name="cp-theme" value={theme} onChange={setTheme} options={[
            { v: 'stars', label: 'Stars' }, { v: 'hearts', label: 'Hearts' }, { v: 'flowers', label: 'Flowers' }, { v: 'bubbles', label: 'Bubbles' },
          ]} />
        )}
        <Segmented legend="Page order" name="cp-order" value={order} onChange={setOrder} options={[
          { v: 'child', label: 'By child', sub: 'each child together' }, { v: 'activity', label: 'By activity', sub: 'all tracing first' },
        ]} />
        <Segmented legend="Paper" name="cp-paper" value={paper} onChange={setPaper} options={[{ v: 'letter', label: 'US Letter' }, { v: 'a4', label: 'A4' }]} />

        <button type="submit" disabled={busy || !names.length || !kinds.length || !ready} class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60">
          {busy ? 'Making your class pack…' : !names.length ? 'Add your class list first' : !ready ? 'Loading letters…' : `Download class pack (${total} pages)`}
        </button>
        {done && <p class="mt-3 text-[14px] text-[#1f7a50]" role="status">Downloaded. Print at 100% size. Tip: print double-sided off if you're handing pages out separately.</p>}
        {error && <p class="mt-3 text-[14px] text-[#b4232c]" role="alert">Something didn't load. Refresh the page and try again.</p>}
      </form>

      <figure>
        <div class="grid gap-4 sm:grid-cols-3">
          {previews.map((svg) => svg
            ? <div class="sheet-frame overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />
            : <div class="sheet-frame aspect-[8.5/11] grid place-items-center text-muted text-sm">Loading…</div>)}
        </div>
        <figcaption class="mt-3 text-[13px] text-muted">{names[0] ? `${names[0]}'s pages. Every child gets the same set.` : 'Example pages. Add your class list to see your own.'}</figcaption>
      </figure>
    </div>
  );
}
