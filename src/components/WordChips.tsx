// Toggle buttons for choosing which sight words go on a sheet. Order always follows the original list.
export default function WordChips(props: {
  legend: string;
  words: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  hint?: string;
}) {
  const on = new Set(props.selected);
  const toggle = (w: string) => {
    const next = new Set(on);
    if (next.has(w)) next.delete(w);
    else next.add(w);
    props.onChange(props.words.filter((x) => next.has(x)));
  };
  return (
    <fieldset class="mb-5">
      <legend class="text-[15px] font-bold mb-1">{props.legend}</legend>
      <div class="flex items-center justify-between gap-3 mb-2 text-[13px] text-muted">
        <span>{props.selected.length} of {props.words.length} chosen</span>
        <span class="flex gap-3">
          <button type="button" class="underline underline-offset-2 hover:text-ink" onClick={() => props.onChange(props.words.slice())}>All</button>
          <button type="button" class="underline underline-offset-2 hover:text-ink" onClick={() => props.onChange([])}>None</button>
        </span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        {props.words.map((w) => {
          const active = on.has(w);
          return (
            <button
              type="button"
              aria-pressed={active}
              onClick={() => toggle(w)}
              class={`rounded-full border px-3 py-1 text-[15px] leading-tight transition-colors ${
                active ? 'border-rule bg-white text-ink font-bold shadow-[inset_0_0_0_1px_var(--color-rule)]' : 'border-hairline bg-white/60 text-muted hover:text-ink'
              }`}
            >
              {w}
            </button>
          );
        })}
      </div>
      {props.hint && <p class="mt-2 text-[13px] text-muted">{props.hint}</p>}
    </fieldset>
  );
}
