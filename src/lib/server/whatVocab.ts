// Server-side check for download labels (`what`, see lib/what.ts): on top of the shape check, every word in a label
// must be one our own menus and page data can produce. A word a visitor typed (a child's name, a custom spelling
// list) isn't in this vocabulary, so a label carrying one is dropped even if a client bug ever let it through.
// Numbers and single letters are allowed (letter A, week 12, within 10).
import { cleanWhat, WHAT_TOOLS } from '../what';
import { PLANS } from '../homeschool';
import { THEMES } from '../program/themes';
import { WP_KINDS, WP_THEMES } from '../wordProblems';
import { FAMILY_KINDS, FAMILY_SLUGS } from '../wordFamilies';
import { KINDS_FOR, BLANK_LAYOUTS } from '../mathSheets';
import coloringPlan from '../../data/coloring-plan.json';
import sightData from '../../data/sight-words.json';

// Words the label builders in lib/what.ts and the call sites add themselves.
const FIXED = `
  lines line large medium small trace only capitals capital and lowercase all first letter class list of words word text
  week weeks to faith track extra math page pages theme custom example set within number start dots rows one
  progress report placement check free new story ready made personalized plan pre k kindergarten sampler
  spelling sentence days the tracing cursive coloring stars hearts flowers bubbles plain review short
`;

let vocab: Set<string> | null = null;
const words = (s: string) => s.toLowerCase().match(/[a-z]+/g) ?? [];

export function whatVocab(): Set<string> {
  if (vocab) return vocab;
  const v = new Set<string>(words(FIXED));
  const add = (s: string | undefined) => { if (s) for (const w of words(s)) v.add(w); };
  WHAT_TOOLS.forEach(add);
  for (const p of Object.values(PLANS)) { add(p.label); for (const w of p.weeks) add(w.title); }
  for (const t of Object.values(THEMES)) add(t.label);
  for (const k of WP_KINDS) add(k.label);
  for (const t of WP_THEMES) add(t.label);
  for (const k of FAMILY_KINDS) add(k.label);
  FAMILY_SLUGS.forEach(add);
  for (const list of Object.values(KINDS_FOR)) for (const k of list) add(k.label);
  for (const b of BLANK_LAYOUTS) add(b.label);
  for (const c of (coloringPlan as any).collections ?? []) for (const p of c.pages ?? []) add(p.title);
  for (const l of sightData as any[]) { add(l.slug); add(l.short); }
  return (vocab = v);
}

/** The full server check: shape (lib/what.ts) plus vocabulary. Returns the label or null. */
export function cleanWhatStrict(v: unknown): string | null {
  const s = cleanWhat(v);
  if (!s) return null;
  const vocab = whatVocab();
  for (const w of words(s)) if (w.length > 1 && !vocab.has(w)) return null;
  return s;
}
