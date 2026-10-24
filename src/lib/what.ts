// "What was downloaded" labels for the anonymous download ping (shared by the browser and the server).
// A label is "Tool: options", built only from choices the visitor picked from our own menus (letter, size, theme,
// week...). Nothing a visitor typed ever goes in: no child names, no custom words or sentences. When the text was
// typed, the label says so ("custom words, 3 lines") instead of repeating it.

export const WHAT_MAX = 120;
const WHAT_CHARS = /^[A-Za-z0-9 ,.:;'()/&+\-]+$/;

/** Every tool name a label may start with. The server drops a label whose tool isn't on this list. */
export const WHAT_TOOLS = [
  'Name tracing', 'Letter tracing', 'Number tracing', 'Sight word tracing', 'Word tracing', 'Alphabet tracing',
  'Alphabet chart', 'Cursive alphabet chart', 'Cursive alphabet', 'Cursive', 'Name coloring', 'Coloring',
  'Sight word flash cards', 'Word families', 'Pre-K math', 'Ten frames', 'More or less', 'Kindergarten math',
  'Kindergarten word problems', 'Kindergarten math sampler', 'Pre-K plan', 'Kindergarten plan', 'Personalized plan', 'Class pack',
] as const;
const TOOL_SET = new Set<string>(WHAT_TOOLS);

/** The server-side check: a short label from our own vocabulary, or null. */
export function cleanWhat(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  if (!s || s.length > WHAT_MAX || !WHAT_CHARS.test(s)) return null;
  const tool = s.split(':')[0].trim();
  if (!TOOL_SET.has(tool)) return null;
  return s;
}

/** Joins a tool and its options into a label, dropping any character the server would refuse. */
export function whatLabel(tool: (typeof WHAT_TOOLS)[number], ...parts: (string | number | false | null | undefined)[]): string {
  const bits = parts.filter((p) => p !== false && p !== null && p !== undefined && p !== '').map((p) => String(p).replace(/[^A-Za-z0-9 ,.:;'()/&+\-]/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const s = bits.length ? `${tool}: ${bits.join(', ')}` : tool;
  return s.length > WHAT_MAX ? s.slice(0, WHAT_MAX).replace(/[ ,]+$/, '') : s;
}

// ---------- Small helpers for option words ----------
export const sizeWord = (size: string) => `${size} lines`;
export const caseWord = (c: 'both' | 'upper' | 'lower' | 'pairs') => (c === 'upper' ? 'capitals' : c === 'lower' ? 'lowercase' : 'capitals and lowercase');
export const styleWord = (s: 'capital' | 'caps' | 'lower') => (s === 'caps' ? 'all capitals' : s === 'lower' ? 'lowercase' : 'first letter capital');
export const kids = (n: number) => (n > 0 ? `class list of ${n}` : '');
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** For typed text: how much there was, never what it said. */
export const typedWords = (text: string) => plural(text.split(/\s+/).filter(Boolean).length, 'word');
export const typedLines = (lines: number) => plural(lines, 'line');

// ---------- Labels per tool (pure, so scripts/test-digest.mts can check them) ----------
export function tracerWhat(o: {
  mode: 'name' | 'letter' | 'number' | 'words'; value: string; style: 'capital' | 'caps' | 'lower'; letterCase: 'both' | 'upper' | 'lower';
  size: string; practice?: string; list?: number; group?: string; chosen?: number; total?: number;
}): string {
  const practice = o.practice === 'trace' ? 'trace only' : '';
  if (o.mode === 'name') return whatLabel('Name tracing', styleWord(o.style), sizeWord(o.size), practice, kids(o.list ?? 0));
  if (o.mode === 'letter') return whatLabel('Letter tracing', /^[a-z]$/i.test(o.value) ? o.value.toUpperCase() : '', caseWord(o.letterCase), sizeWord(o.size), practice);
  if (o.mode === 'number') return whatLabel('Number tracing', /^\d{1,2}$/.test(o.value) ? o.value : '', sizeWord(o.size), practice);
  const group = o.group && /^[a-z0-9-]{1,30}$/.test(o.group) ? o.group.replace(/-/g, ' ') : '';
  return whatLabel('Sight word tracing', group, o.total ? `${o.chosen ?? 0} of ${o.total} words` : '', sizeWord(o.size), practice);
}

/** "Coloring: cute turkey" from the page title "Cute Turkey Coloring Page". */
export const coloringWhat = (title: string) => whatLabel('Coloring', title.replace(/\s*coloring page\s*$/i, '').toLowerCase());

export function weekPackWhat(o: { level: 'pre-k' | 'kindergarten'; week: number; toWeek?: number; title?: string; faith?: boolean; math?: boolean; list?: number }): string {
  const tool = o.level === 'pre-k' ? 'Pre-K plan' : 'Kindergarten plan';
  const weeks = o.toWeek && o.toWeek !== o.week ? `weeks ${o.week} to ${o.toWeek}` : `week ${o.week}${o.title ? ` (${o.title})` : ''}`;
  return whatLabel(tool, weeks, o.faith && 'faith track', o.math && 'extra math page', kids(o.list ?? 0));
}

/** Cursive worksheet or name coloring page (FontTool). The text box is typed, so only its length is reported. */
export function fontToolWhat(o: { kind: 'cursive' | 'coloring'; text: string; preset?: string; size: string; theme: string; caps: boolean; list?: number }): string {
  if (o.kind === 'coloring') return whatLabel('Name coloring', `${o.theme} theme`, o.caps ? 'capitals' : 'lowercase', kids(o.list ?? 0));
  const what = o.list ? '' : o.preset && o.text === o.preset ? 'page example' : `custom text, ${typedWords(o.text)}`;
  return whatLabel('Cursive', what, sizeWord(o.size), kids(o.list ?? 0));
}

/** Free-text word tracing: an example we wrote is named; anything else is "custom words, N lines". */
export function wordTracingWhat(o: { text: string; lines: number; examples: { label: string; text: string }[]; preset?: string; size: string }): string {
  const ex = o.examples.find((e) => e.text === o.text);
  const what = ex ? `example (${ex.label})` : o.preset && o.text === o.preset ? 'page example' : `custom words, ${typedLines(o.lines)}`;
  return whatLabel('Word tracing', what, sizeWord(o.size));
}
