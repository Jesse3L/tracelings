import { useMemo, useState } from 'preact/hooks';
import { buildSheet } from '../lib/sheet';
import { pageToSvg } from '../lib/render';

// A cropped two-row strip of the real worksheet, so the homepage demo is the product itself.
export default function HeroTracer({ href = '/name-tracing/' }: { href?: string }) {
  const [name, setName] = useState('Mateo');
  const svg = useMemo(() => {
    const page = buildSheet({ name, style: 'capital', size: 'large', paper: 'letter', practice: 'trace', startDots: true, modelRow: true, credit: false });
    return pageToSvg(page).replace(/viewBox="[^"]+"/, 'viewBox="30 80 552 236"');
  }, [name]);

  function go(e: Event) {
    e.preventDefault();
    try { sessionStorage.setItem('tl-name', name); } catch { /* storage unavailable */ }
    window.location.href = href;
  }

  return (
    <form onSubmit={go} class="w-full">
      <div class="sheet-frame overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />
      <div class="mt-4 flex flex-col sm:flex-row gap-3">
        <label class="flex-1">
          <span class="sr-only">Child's name</span>
          <input
            type="text"
            value={name}
            maxLength={24}
            autoComplete="off"
            spellcheck={false}
            placeholder="Type a name"
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            class="w-full rounded-lg border border-hairline bg-white px-4 py-3 text-xl text-ink focus:border-rule focus:outline-none"
          />
        </label>
        <button type="submit" class="btn-pencil px-6 py-3 text-lg">Make a name tracing sheet</button>
      </div>
      <p class="mt-2 text-[13px] text-muted">Try your child's name. It stays on this device.</p>
    </form>
  );
}
