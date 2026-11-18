// The personalized storybook: pick a book, type the child's name, see the cover and first page free, pay $5 right
// on the page, and the browser builds the PDF. The name stays in this browser (the server only sees the book id).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { giftBookPages, bookName, type GiftBook } from '../lib/storybook/giftbook';
import type { BookMeta } from '../lib/storybook/catalog';
import { pageToSvg } from '../lib/render';
import { savePdf } from '../lib/download';
import { whatLabel } from '../lib/what';
import type { Paper } from '../lib/sheet';
import SquarePayForm from './SquarePayForm';

type Owned = { t: string; id: string; title: string };
const OWNED_KEY = 'tl-storybooks';
const readOwned = (): Owned[] => { try { return JSON.parse(localStorage.getItem(OWNED_KEY) ?? '[]'); } catch { return []; } };
const keepOwned = (o: Owned) => { try { localStorage.setItem(OWNED_KEY, JSON.stringify([o, ...readOwned().filter((x) => x.t !== o.t)].slice(0, 30))); } catch { /* storage unavailable */ } };
const track = (name: string, params: Record<string, unknown> = {}) => { try { (window as any).gtag?.('event', name, { tool_page: location.pathname, ...params }); } catch { /* ignore */ } };
const ages = (b: BookMeta) => `${b.level === 'pre-k' ? 'Ages 3 to 5' : 'Ages 5 to 7'}, ${b.pages} story pages`;

export default function StorybookMaker({ books, start }: { books: BookMeta[]; start?: string }) {
  const groups = useMemo(() => [...new Set(books.map((b) => b.group))], [books]);
  const [bookId, setBookId] = useState(start && books.some((b) => b.id === start) ? start : books[0].id);
  const book = books.find((b) => b.id === bookId)!;
  const [group, setGroup] = useState(book.group);
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [email, setEmail] = useState('');
  const [paper, setPaper] = useState<Paper>('letter');
  const [paying, setPaying] = useState(false);
  const [emailErr, setEmailErr] = useState(false);
  const [bought, setBought] = useState<{ book: GiftBook; title: string } | null>(null);
  const [owned, setOwned] = useState<Owned[]>([]);
  const [busy, setBusy] = useState(false);
  const [linkErr, setLinkErr] = useState('');

  useEffect(() => {
    setOwned(readOwned());
    try { const n = sessionStorage.getItem('tl-story-name') || localStorage.getItem('tl-child-name'); if (n) setName(n); } catch { /* ignore */ }
    const t = new URLSearchParams(location.search).get('t');
    if (t) openOwned(t);
    track('storybook_view', { book: bookId });
  }, []);

  async function openOwned(t: string) {
    setLinkErr('');
    try {
      const r = await fetch(`/api/storybook/book/?t=${encodeURIComponent(t)}`);
      const d = await r.json();
      if (!r.ok || !d.book) throw new Error('bad');
      setBought({ book: d.book, title: d.book.title });
      keepOwned({ t, id: d.id, title: d.book.title });
      setOwned(readOwned());
      setTimeout(() => document.getElementById('your-book')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch {
      setLinkErr('That download link did not work. Email us and we will send the book again.');
    }
  }

  // The free preview: the cover and the first story page, with the child's name.
  const preview = useMemo(() => {
    const pages = giftBookPages({ title: book.title, kind: book.kind, cover: book.cover, pages: [book.first] }, { name, from, paper });
    return pages.slice(0, 2).map(pageToSvg);
  }, [bookId, name, from, paper]);

  async function download(b: GiftBook) {
    setBusy(true);
    try {
      const pages = giftBookPages(b, { name, from, paper });
      const file = `${bookName(name).replace(/[^A-Za-z0-9]+/g, '-')}-${b.title.replace(/[^A-Za-z0-9]+/g, '-')}.pdf`.toLowerCase();
      await savePdf(pages, file, b.title, whatLabel('Storybook', book.group));
    } finally { setBusy(false); }
  }

  async function pay(sourceId: string, verificationToken?: string) {
    const r = await fetch('/api/storybook/pay/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId, email: email.trim(), sourceId, verificationToken }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) return { ok: false as const, message: d.message, code: d.code || d.error };
    keepOwned({ t: d.token, id: bookId, title: d.book.title });
    setOwned(readOwned());
    setBought({ book: d.book, title: d.book.title });
    setPaying(false);
    try { localStorage.setItem('tl-child-name', name); } catch { /* ignore */ }
    track('storybook_bought', { book: bookId });
    await download(d.book);
    return { ok: true as const };
  }

  const ready = name.trim().length > 0;
  const previewBlock = (
    <>
      <p class="text-[14px] text-muted">Free preview: the cover and the first page{ready ? `, with ${bookName(name)}` : ''}.</p>
      <div class="grid grid-cols-2 gap-3">
        {preview.map((svg) => <div class="rounded-lg border border-hairline bg-white shadow-sm overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />)}
      </div>
      <p class="text-[13px] text-muted">The pictures are line art, so the book doubles as a coloring book.</p>
    </>
  );
  const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  return (
    <div class="grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:items-start">
      <div class="grid gap-5">
        {bought && (
          <div id="your-book" class="rounded-xl border border-[#9fd3b8] bg-[#eef8f2] p-5" role="status">
            <p class="font-bold text-lg text-ink">Your storybook is ready: {bought.title}</p>
            <p class="mt-1 text-[15px] text-muted leading-relaxed">Print it as many times as you like. We emailed you a link to download it again later.</p>
            <label class="block mt-3">
              <span class="block text-[14px] font-bold mb-1">Child's name in the book</span>
              <input value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} maxLength={24} class="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-[16px]" />
            </label>
            <button type="button" disabled={busy || !ready} onClick={() => download(bought.book)} class="btn-pencil mt-3 w-full px-5 py-3 text-lg disabled:opacity-60">{busy ? 'Making your PDF…' : 'Download the storybook'}</button>
          </div>
        )}
        {linkErr && <p class="text-[14px] text-[#b4232c]" role="alert">{linkErr}</p>}

        <fieldset>
          <legend class="text-[15px] font-bold mb-2">1. Pick a story</legend>
          <div class="flex flex-wrap gap-2 mb-3">
            {groups.map((g) => (
              <button type="button" onClick={() => { setGroup(g); const first = books.find((b) => b.group === g); if (first) setBookId(first.id); }}
                class={`rounded-full border px-3 py-1.5 text-[14px] font-bold ${g === group ? 'border-rule bg-[#eef4ff] text-ink' : 'border-hairline bg-white text-muted hover:text-ink'}`}>{g}</button>
            ))}
          </div>
          <div class="grid gap-2 sm:grid-cols-2">
            {books.filter((b) => b.group === group).map((b) => (
              <label class={`cursor-pointer rounded-lg border p-2 flex gap-3 items-center ${b.id === bookId ? 'border-rule shadow-[inset_0_0_0_1px_var(--color-rule)] bg-[#f6f8fc]' : 'border-hairline bg-white'}`}>
                <input type="radio" name="book" class="sr-only" checked={b.id === bookId} onChange={() => { setBookId(b.id); setPaying(false); track('storybook_pick', { book: b.id }); }} />
                <img src={b.cover.src.replace('.png', '-thumb.webp')} alt="" width={96} height={72} loading="lazy" class="w-24 rounded border border-hairline bg-white" />
                <span><span class="block font-bold text-ink leading-snug">{b.title}</span><span class="block text-[13px] text-muted">{ages(b)}</span></span>
              </label>
            ))}
          </div>
        </fieldset>

        <div class="grid gap-3">
          <p class="text-[15px] font-bold">2. Put your child in the story</p>
          <label class="block">
            <span class="block text-[14px] mb-1">Child's first name</span>
            <input value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} maxLength={24} autoComplete="off" placeholder="Their name" class="w-full rounded-lg border border-hairline bg-white px-4 py-3 text-lg focus:border-rule focus:outline-none" />
          </label>
          <label class="block">
            <span class="block text-[14px] mb-1">From (optional, for the cover)</span>
            <input value={from} onInput={(e) => setFrom((e.target as HTMLInputElement).value)} maxLength={30} placeholder="Grandma, Mom and Dad, Aunt Jo" class="w-full rounded-lg border border-hairline bg-white px-4 py-2.5 text-[16px] focus:border-rule focus:outline-none" />
          </label>
          <label class="flex items-center gap-2 text-[14px] text-muted">Paper
            <select value={paper} onChange={(e) => setPaper((e.target as HTMLSelectElement).value as Paper)} class="rounded border border-hairline bg-white px-2 py-1 text-ink"><option value="letter">US Letter</option><option value="a4">A4</option></select>
          </label>
          <p class="text-[13px] text-muted">The name stays on this device. It is never sent to us.</p>
        </div>

        <div class="grid gap-3 lg:hidden">{previewBlock}</div>

        <div class="rounded-xl border border-hairline bg-white p-5">
          <p class="text-[15px] font-bold">3. Get the whole book</p>
          <p class="mt-1 text-[15px] text-muted">{book.pages} story pages, a cover with {ready ? bookName(name) : 'their name'} and a "the end" page to draw on. Printable PDF, yours to print again and again.</p>
          <p class="mt-3 text-2xl font-bold text-ink">$5</p>
          {!paying ? (
            <div class="mt-3 grid gap-3">
              <label class="block">
                <span class="block text-[14px] mb-1">Your email (for the receipt and a link to download again)</span>
                <input type="email" value={email} onInput={(e) => { setEmail((e.target as HTMLInputElement).value); setEmailErr(false); }} autoComplete="email" placeholder="you@example.com" class="w-full rounded-lg border border-hairline px-4 py-3 text-lg focus:border-rule focus:outline-none" />
              </label>
              {emailErr && <p class="text-[14px] text-[#b4232c]" role="alert">That email doesn't look quite right.</p>}
              {!ready && <p class="text-[14px] text-muted">Type your child's name above first.</p>}
              <button type="button" disabled={!ready} onClick={() => { if (!okEmail) return setEmailErr(true); setPaying(true); track('storybook_pay_open', { book: bookId }); }} class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60">Buy the storybook for $5</button>
            </div>
          ) : (
            <div class="mt-3">
              <SquarePayForm key={bookId} cents={500} label={`Storybook: ${book.title}`} intent="CHARGE" wallets squarePage={false} buttonText="Pay {total} and download"
                note={`One-time purchase. Receipt and download link go to ${email.trim()}.`} source="storybook"
                onToken={pay} onFallback={() => { setPaying(false); setLinkErr('The card form could not load. Please try again in a minute, or email hello@tracelings.com and we will send the book.'); }} onClose={() => setPaying(false)} />
            </div>
          )}
        </div>

        {owned.length > 0 && !bought && (
          <div class="rounded-xl border border-hairline bg-white p-4">
            <p class="text-[15px] font-bold">Your storybooks on this device</p>
            <ul class="mt-2 grid gap-1">
              {owned.map((o) => <li><button type="button" class="text-[15px] text-[#2f5fc4] underline underline-offset-2" onClick={() => openOwned(o.t)}>{o.title}</button></li>)}
            </ul>
          </div>
        )}
      </div>

      <div class="hidden lg:grid gap-4 lg:sticky lg:top-4">{previewBlock}</div>
    </div>
  );
}
