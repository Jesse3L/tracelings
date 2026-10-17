// The big picture book's story rules, shared by the AI story writer (server), the templates and the pages.
//
// Scene art: src/lib/program/sceneArt.json is written by the art agent and lists ONLY scenes that passed review:
//   { "<theme>": { "<sceneId>": { "w": 1200, "h": 900 } }, "pathsReady": { "<theme>": ["<pathId>", ...] } }
// The file may be missing or empty. Then no theme has a picture book yet and every week prints the old little book.
//
// Book size: printed one-sided, each sheet has 2 half strips, and each strip folds in half (pictures outside) into a
// leaf with a page on each face. So every sheet makes 4 book pages: Pre-K is 2 sheets (cover + 6 story pages +
// "The end"), Kindergarten is 3 sheets (cover + 10 story pages + "The end"). Longer catalog paths are trimmed to fit
// (fitPath), always keeping the opening, the problem, the help, the solve and a warm close.
import type { Level } from '../homeschool';
import type { ThemeId } from './types';
import { SCENES, type Beat, type Scene, type StoryPath } from './scenes';

export interface SceneArtEntry { w: number; h: number }
export interface SceneArtManifest {
  pathsReady?: Partial<Record<ThemeId, string[]>>;
  [theme: string]: Record<string, SceneArtEntry> | Partial<Record<ThemeId, string[]>> | undefined;
}

/** The bundled manifest. Vite replaces import.meta.glob at build time (an empty object when the file is absent);
 *  plain Node (tsx scripts) has no import.meta.glob, so the call throws and scripts set a manifest with setSceneArt. */
function bundled(): SceneArtManifest {
  try {
    // Written exactly as import.meta.glob(...) so Vite finds and replaces it.
    const mods = import.meta.glob('./sceneArt.json', { eager: true, import: 'default' }) as Record<string, SceneArtManifest>;
    return Object.values(mods)[0] ?? {};
  } catch {
    return {};
  }
}

let manifest: SceneArtManifest = bundled();

/** Replace the manifest (scripts and tests). */
export function setSceneArt(m: SceneArtManifest | null | undefined) { manifest = m && typeof m === 'object' ? m : {}; }
export const sceneArtManifest = () => manifest;

function themeArt(theme: ThemeId): Record<string, SceneArtEntry> {
  const t = manifest[theme];
  return t && typeof t === 'object' && !Array.isArray(t) ? (t as Record<string, SceneArtEntry>) : {};
}

/** Size of a reviewed scene picture, or undefined when that scene has no art yet. */
export function sceneArt(theme: ThemeId, id: string): SceneArtEntry | undefined {
  const e = themeArt(theme)[id];
  return e && Number(e.w) > 0 && Number(e.h) > 0 && SCENES[theme]?.scenes.some((s) => s.id === id) ? { w: Number(e.w), h: Number(e.h) } : undefined;
}
/** Every reviewed scene of a theme, in catalog order. */
export function readyScenes(theme: ThemeId): Scene[] {
  return (SCENES[theme]?.scenes ?? []).filter((s) => sceneArt(theme, s.id));
}

// ---------- Book size and story arc ----------

export const BOOK_PAGES: Record<Level, number> = { 'pre-k': 6, kindergarten: 10 };

/**
 * How much text one book page may hold. The AI prompt (pageRuleText), the AI checker and the hand-written
 * templates all use this one rule. A short exclamation of 1 to 3 words ending in "!" ("Oh no!", "Tap, tap, tap!")
 * is not counted as a sentence, but its words count toward the page total.
 */
export const PAGE_RULES: Record<Level, { sentences: number; words: number; sentenceWords: number }> = {
  'pre-k': { sentences: 2, words: 14, sentenceWords: 12 },
  kindergarten: { sentences: 3, words: 30, sentenceWords: 12 },
};
/** The page rule in words, for the AI prompt. */
export function pageRuleText(level: Level): string {
  const r = PAGE_RULES[level];
  return `Each page: 1 to ${r.sentences} short sentences, at most ${r.sentenceWords} words in a sentence and at most ${r.words} words on the whole page ({{name}} counts as one word). A tiny exclamation of 1 to 3 words ("Oh no!", "Yum!") does not count as a sentence, but its words count toward the ${r.words}.`;
}
export const pageWords = (s: string) => (s.replace(/\{\{name\}\}/g, ' kid ').toLowerCase().match(/[a-z0-9']+/g) ?? []).length;
export const pageSentences = (s: string) => s.split(/(?<=[.!?]["”]?)\s+(?=["“]?[A-Z{0-9])/).map((x) => x.trim()).filter(Boolean);
/** Why a page breaks the page rule for the level, or null. */
export function pageLengthProblem(level: Level, text: string): string | null {
  const r = PAGE_RULES[level];
  const real = pageSentences(text).filter((x) => !(/!["”]?$/.test(x) && pageWords(x) <= 3));
  if (real.length > r.sentences) return 'too many sentences for the level';
  if (pageWords(text) > r.words) return 'too long for the level';
  if (real.some((x) => pageWords(x) > r.sentenceWords)) return 'sentence too long';
  return null;
}
export const BOOK_SHEETS: Record<Level, number> = { 'pre-k': 2, kindergarten: 3 };

/** Where each beat sits in the arc. A story never steps back to an earlier rank. */
export const BEAT_RANK: Record<Beat, number> = { opening: 0, explore: 1, find: 1, problem: 2, try: 3, help: 3, solve: 4, celebrate: 5, rest: 5, ending: 5 };

/**
 * Trims a scene list to n pages. Keeps the first scene, the problem, the first help and the first solve, and ends
 * on a celebration when it has to choose between that and a quiet last page. Removes, in this order: a rest that
 * isn't last, explore, a second celebrate, an ending that isn't last, a second try, a second find, try, the last
 * page (only if a celebrate comes before it), find, then celebrate.
 */
export function fitPath(theme: ThemeId, scenes: string[], n: number): string[] {
  const beat = (id: string) => SCENES[theme].scenes.find((s) => s.id === id)?.beat;
  const out = [...scenes];
  const keep = (i: number) => {
    const b = beat(out[i]);
    if (i === 0) return true;
    if (b === 'problem') return true;
    if (b === 'help' && out.findIndex((x) => beat(x) === 'help') === i) return true;
    if (b === 'solve' && out.findIndex((x) => beat(x) === 'solve') === i) return true;
    return false;
  };
  const nth = (i: number) => out.slice(0, i).filter((x) => beat(x) === beat(out[i])).length; // earlier ones with the same beat
  const last = () => out.length - 1;
  const rules: ((i: number) => boolean)[] = [
    (i) => beat(out[i]) === 'rest' && i !== last(),
    (i) => beat(out[i]) === 'explore',
    (i) => beat(out[i]) === 'celebrate' && nth(i) > 0,
    (i) => beat(out[i]) === 'ending' && i !== last(),
    (i) => beat(out[i]) === 'try' && nth(i) > 0,
    (i) => beat(out[i]) === 'find' && nth(i) > 0,
    (i) => beat(out[i]) === 'try',
    // The find page sets up what the problem is about ("the egg", "the ball"), so a quiet last page goes before it
    // whenever a celebration can close the book instead.
    (i) => i === last() && (beat(out[i]) === 'rest' || beat(out[i]) === 'ending') && out.some((x) => beat(x) === 'celebrate'),
    (i) => beat(out[i]) === 'find',
    (i) => beat(out[i]) === 'celebrate',
    (i) => beat(out[i]) === 'help' || beat(out[i]) === 'solve',
  ];
  while (out.length > n) {
    let removed = false;
    for (const rule of rules) {
      // Latest match first, so earlier set-up pages stay.
      for (let i = out.length - 1; i >= 0; i--) {
        if (!keep(i) && rule(i)) { out.splice(i, 1); removed = true; break; }
      }
      if (removed) break;
    }
    if (!removed) break;
  }
  return out;
}

/** Why a scene sequence is not a good story arc, or null when it is. */
export function arcProblem(theme: ThemeId, scenes: string[]): string | null {
  const beats = scenes.map((id) => SCENES[theme].scenes.find((s) => s.id === id)?.beat);
  if (beats.some((b) => !b)) return 'unknown scene';
  const bs = beats as Beat[];
  if (bs[0] !== 'opening') return 'does not start with an opening';
  if (bs.filter((b) => b === 'problem').length !== 1) return 'needs exactly one problem';
  const p = bs.indexOf('problem');
  const s = bs.indexOf('solve');
  if (s < 0 || s < p) return 'no solve after the problem';
  if (!bs.slice(p + 1, s).includes('help')) return 'no help between the problem and the solve';
  for (let i = 1; i < bs.length; i++) if (BEAT_RANK[bs[i]] < BEAT_RANK[bs[i - 1]]) return `steps back from ${bs[i - 1]} to ${bs[i]}`;
  if (new Set(scenes).size !== scenes.length) return 'repeats a scene';
  return null;
}

/** A ready path, trimmed to the book. */
export interface ReadyPath extends StoryPath { fitted: string[] }

/**
 * The paths for a theme and level that can be printed as a picture book: listed in pathsReady, the right level,
 * and every scene of the trimmed path has reviewed art.
 */
export function readyPaths(theme: ThemeId, level: Level): ReadyPath[] {
  const ready = new Set(manifest.pathsReady?.[theme] ?? []);
  const n = BOOK_PAGES[level];
  return (SCENES[theme]?.paths ?? [])
    .filter((p) => p.level === level && ready.has(p.id))
    .map((p) => ({ ...p, fitted: fitPath(theme, p.scenes, n) }))
    .filter((p) => p.fitted.length === n && p.fitted.every((id) => sceneArt(theme, id)) && !arcProblem(theme, p.fitted));
}

/**
 * The ready path a week's story uses, picked by code (never by the AI) so every story follows one drawn plot.
 * Paths rotate by week (week 1 gets the first path, as the free week does). `avoid` holds path ids the child had in
 * recent weeks; the rotation skips them while another path is left. `shift` moves on for a "new story" redo.
 */
export function pickPath(theme: ThemeId, level: Level, weekIndex: number, avoid: string[] = [], shift = 0): ReadyPath | null {
  const paths = readyPaths(theme, level);
  if (!paths.length) return null;
  const start = (((weekIndex - 1 + shift) % paths.length) + paths.length) % paths.length;
  for (let k = 0; k < paths.length; k++) {
    const p = paths[(start + k) % paths.length];
    if (!avoid.includes(p.id)) return p;
  }
  return paths[start];
}

/** True when a story can print as the picture book: it has scenes, the right number, and all of them have art. */
export function storyHasArt(theme: ThemeId, story: { pages: string[]; scenes?: string[] }): boolean {
  const sc = story.scenes;
  return Array.isArray(sc) && sc.length > 0 && sc.length === story.pages.length && sc.every((id) => sceneArt(theme, id))
    && (sc.length === BOOK_PAGES['pre-k'] || sc.length === BOOK_PAGES.kindergarten);
}

// ---------- Scene images (bytes for the PDF) ----------

/** Public URL of a scene picture (same as scenes.ts sceneSrc). */
export const sceneUrl = (theme: ThemeId, id: string) => `/program/scenes/${theme}/${id}.png`;

/** Cast names and the words a page may use for each, for checking that a page only names who is in its picture. */
export function castTerms(theme: ThemeId): { name: string; terms: string[] }[] {
  const cast = SCENES[theme].cast;
  const all = cast.flatMap((c) => c.words.map((w) => w.toLowerCase()));
  const shared = new Set(all.filter((w, i) => all.indexOf(w) !== i));
  const generic = new Set(['he', 'his', 'she', 'her', 'it', 'its', 'they', 'little', 'baby', 'big', 'bird', 'truck', 'dinosaur', 'dino']);
  return cast.map((c) => ({
    name: c.name,
    terms: [...new Set([c.name.toLowerCase(), ...c.name.toLowerCase().split(' ').filter((p) => p !== 'princess' && p !== 'sir'), ...c.words.map((w) => w.toLowerCase())])]
      .filter((w) => !shared.has(w) && !generic.has(w)),
  }));
}
