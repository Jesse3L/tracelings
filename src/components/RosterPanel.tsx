import { useState } from 'preact/hooks';
import { parseRoster, useRoster } from '../lib/roster';

const link = 'text-[#2f5fc4] underline underline-offset-2';

/** Member class list: paste or upload once, saved in this browser, reused by every tool. */
export default function RosterPanel(props: { use: boolean; onUse: (v: boolean) => void; maxNames: number; what: string }) {
  const [names, setNames] = useRoster();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const open = editing || names.length === 0;
  const preview = parseRoster(draft);

  function startEdit() { setDraft(names.join('\n')); setNote(''); setEditing(true); }
  function save() {
    const list = parseRoster(draft);
    setNames(list);
    setEditing(false);
    setNote(list.length ? `Saved ${list.length} name${list.length === 1 ? '' : 's'} in this browser.` : 'Class list cleared.');
    props.onUse(list.length > 0);
  }
  async function upload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (/\.(xlsx?|numbers)$/i.test(file.name)) {
      setNote('That’s a spreadsheet file. Copy the name column and paste it in the box instead, or save it as CSV first.');
      return;
    }
    const text = await file.text().catch(() => '');
    const list = parseRoster(text);
    if (!list.length) { setNote('We couldn’t find any names in that file. Try pasting them instead.'); return; }
    setDraft(list.join('\n'));
    setNote(`Found ${list.length} names. Check them, then save.`);
  }

  return (
    <div class="mb-5 rounded-lg border border-hairline bg-white p-4">
      <div class="flex items-baseline justify-between gap-3">
        <span class="text-[15px] font-bold text-ink">Class list</span>
        <span class="text-[12px] text-muted">Member feature</span>
      </div>

      {!open && (
        <>
          <label class="mt-3 flex items-start gap-3 cursor-pointer text-[15px] text-ink">
            <input id="roster-use" type="checkbox" class="mt-1 size-4 accent-[#5b86d9]" checked={props.use} onChange={(e) => props.onUse((e.target as HTMLInputElement).checked)} />
            <span>Print {props.what} for my whole class <span class="text-muted">({Math.min(names.length, props.maxNames)} names)</span></span>
          </label>
          <p class="mt-2 text-[13px] text-muted leading-snug">
            {names.slice(0, 6).join(', ')}{names.length > 6 ? ` and ${names.length - 6} more` : ''}.{' '}
            <button type="button" onClick={startEdit} class={link}>Edit list</button>
          </p>
          {names.length > props.maxNames && (
            <p class="mt-2 text-[13px] text-[#8a5a00]">Your plan prints up to {props.maxNames} names at once, so the first {props.maxNames} are used.</p>
          )}
        </>
      )}

      {open && (
        <>
          <p class="mt-2 text-[13px] text-muted leading-snug">Paste your names once and every tool remembers them. Copying the name column from Excel or Google Sheets works.</p>
          <textarea
            id="roster-text"
            rows={5}
            value={draft}
            onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)}
            placeholder={'One name per line\nAva\nLiam\nNoah'}
            class="mt-3 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-[17px] text-ink placeholder:text-[#a3acbf] focus:border-rule focus:outline-none"
          />
          <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
            <button type="button" onClick={save} disabled={!preview.length && !names.length} class="rounded-lg bg-[#2f5fc4] px-4 py-2 font-bold text-white disabled:opacity-50">
              {preview.length ? `Save ${preview.length} name${preview.length === 1 ? '' : 's'}` : names.length ? 'Clear list' : 'Save list'}
            </button>
            <label class={`${link} cursor-pointer`}>
              Upload CSV or text file
              <input type="file" accept=".csv,.txt,text/csv,text/plain,.xlsx,.xls" class="sr-only" onChange={upload} />
            </label>
            {editing && names.length > 0 && <button type="button" onClick={() => setEditing(false)} class="text-muted underline underline-offset-2">Cancel</button>}
          </div>
        </>
      )}
      {note && <p class="mt-2 text-[13px] text-[#1f7a50]" role="status">{note}</p>}
      <p class="mt-2 text-[12px] text-muted">Saved on this device only. Names never leave your browser.</p>
    </div>
  );
}
