// Preschool schedule printables (/preschool-schedule/, /preschool-schedule/bedtime-routine-chart/ and
// /preschool-schedule/morning-routine-chart/ and /preschool-schedule/potty-training-chart/): a picture schedule for the day, the
// morning, bedtime or the potty steps, cut-apart picture cards, a weekly homeschool chart and a potty sticker chart. One page each, drawn
// in the browser like every other maker, so the child's name never leaves the device.
// Routine pictures live in public/schedule/routine.json (0..1000 paths, even-odd fill).
import { PAPER, COLORS, cleanName, type Item, type Page, type Paper } from './sheet';
import { M, footer, box, circlePath, starPath, textW } from './homeschool';
import { THEMES, THEME_IDS, iconPath, iconsReady, loadThemeIcons, smallIcons } from './program/themes';
import type { ThemeId } from './program/types';

export type ScheduleKind = 'day' | 'cards' | 'week' | 'stickers';
/** What the day and card pages are for: the day ("Maya's Day"), the morning ("Maya's Morning"), bedtime ("Maya's Bedtime")
 * or the potty steps ("Maya's Potty Steps"). */
export type Routine = 'day' | 'bedtime' | 'morning' | 'potty';

export interface Step { icon: string; label: string; time: string }

export interface ScheduleOptions {
  kind: ScheduleKind;
  name: string; // may be empty
  paper: Paper;
  credit: boolean;
  steps: Step[]; // the day, in order (picture schedule and cards)
  subjects: string[]; // ids from SUBJECTS (weekly chart)
  routine?: Routine; // default 'day'
  boxes?: number; // sticker chart: boxes for each day (STICKER_BOXES), default 5
  reward?: string; // sticker chart: what the child is working toward, printed on the reward line (may be empty)
  theme?: StickerTheme; // sticker chart: a light picture in each circle instead of the star (default 'stars')
}

/** Pictures for the sticker chart circles: plain stars, or one of the program's interest themes (our own line art). */
export type StickerTheme = 'stars' | ThemeId;
export const STICKER_THEMES: { v: StickerTheme; label: string }[] = [
  { v: 'stars', label: 'Stars' },
  ...THEME_IDS.map((id) => ({ v: id as StickerTheme, label: THEMES[id].label })),
];
/** One word for titles and file names: "dinosaur", "unicorn". Empty for stars. */
export const stickerThemeWord = (t: StickerTheme = 'stars') =>
  t === 'stars' ? '' : ({ dinosaurs: 'dinosaur', trucks: 'truck', unicorns: 'unicorn', ocean: 'ocean', space: 'space', farm: 'farm', bugs: 'bug', castles: 'castle', trains: 'train', sports: 'sports', pets: 'pet', jungle: 'jungle' } as Record<string, string>)[t] ?? t;
/** Loads a sticker theme's pictures (no-op for stars). Pages drawn before they arrive show the plain stars. */
export const loadStickerTheme = (t: StickerTheme, fetcher?: IconFetcher) => (t === 'stars' ? Promise.resolve() : loadThemeIcons([t], fetcher));

export const SCHEDULE_KINDS: { v: ScheduleKind; label: string; sub: string }[] = [
  { v: 'day', label: 'Picture schedule for the day', sub: 'The day in order, with pictures and a box to check off' },
  { v: 'cards', label: 'Cut-apart picture cards', sub: '12 cards to cut out and stick on a strip or the fridge' },
  { v: 'week', label: 'Weekly homeschool chart', sub: 'Monday to Friday, a row for each kind of learning' },
  { v: 'stickers', label: 'Potty sticker chart', sub: 'A week of boxes for a sticker or a star each time' },
];
/** The page types every schedule maker shows unless a page picks its own. The sticker chart is for the potty page. */
export const DEFAULT_KINDS: ScheduleKind[] = ['day', 'cards', 'week'];
export const STICKER_BOXES = [3, 4, 5, 6, 8];

/** Every routine picture, with the label it starts with. Parents can change the words. */
export const ACTIVITIES: { icon: string; label: string }[] = [
  { icon: 'wake-up', label: 'Wake up' },
  { icon: 'get-dressed', label: 'Get dressed' },
  { icon: 'breakfast', label: 'Breakfast' },
  { icon: 'brush-teeth', label: 'Brush teeth' },
  { icon: 'writing', label: 'Letters' },
  { icon: 'math', label: 'Numbers' },
  { icon: 'story', label: 'Story time' },
  { icon: 'outside', label: 'Play outside' },
  { icon: 'snack', label: 'Snack' },
  { icon: 'lunch', label: 'Lunch' },
  { icon: 'quiet-time', label: 'Quiet time' },
  { icon: 'art', label: 'Art' },
  { icon: 'music', label: 'Music' },
  { icon: 'play', label: 'Free play' },
  { icon: 'puzzles', label: 'Puzzles' },
  { icon: 'clean-up', label: 'Clean up' },
  { icon: 'bath', label: 'Bath' },
  { icon: 'pajamas', label: 'Pajamas' },
  { icon: 'potty', label: 'Potty' },
  { icon: 'wash-hands', label: 'Wash hands' },
  { icon: 'wash-face', label: 'Wash face' },
  { icon: 'drink-water', label: 'Drink of water' },
  { icon: 'clothes-tomorrow', label: 'Clothes for tomorrow' },
  { icon: 'hug', label: 'Hugs and kisses' },
  { icon: 'night-light', label: 'Night light on' },
  { icon: 'lights-out', label: 'Lights out' },
  { icon: 'bedtime', label: 'Bedtime' },
  { icon: 'brush-hair', label: 'Brush hair' },
  { icon: 'make-bed', label: 'Make bed' },
  { icon: 'shoes', label: 'Shoes on' },
  { icon: 'coat', label: 'Coat on' },
  { icon: 'backpack', label: 'Backpack' },
  { icon: 'lunchbox', label: 'Lunchbox' },
  { icon: 'feed-pet', label: 'Feed the pet' },
  { icon: 'set-table', label: 'Set the table' },
  { icon: 'water-plants', label: 'Water the plants' },
  { icon: 'toilet', label: 'Sit on the toilet' },
  { icon: 'step-stool', label: 'Step up on the stool' },
  { icon: 'underwear', label: 'Pants down' },
  { icon: 'toilet-paper', label: 'Wipe' },
  { icon: 'flush', label: 'Flush' },
  { icon: 'pants-up', label: 'Pants up' },
  { icon: 'soap', label: 'Soap' },
  { icon: 'towel', label: 'Dry hands' },
  { icon: 'star', label: 'Star' },
];
export const activityLabel = (icon: string) => ACTIVITIES.find((a) => a.icon === icon)?.label ?? icon;

const step = (icon: string, time = ''): Step => ({ icon, label: activityLabel(icon), time });

/** Ready-made days to start from. Times are only a suggestion and can be cleared. */
export const PRESETS: { v: string; label: string; steps: Step[]; routine?: Routine }[] = [
  {
    v: 'morning', label: 'Homeschool morning',
    steps: [step('wake-up', '7:00'), step('get-dressed'), step('breakfast', '7:30'), step('brush-teeth'), step('writing', '8:30'), step('math'), step('snack', '9:15'), step('outside'), step('story', '10:30'), step('lunch', '11:30')],
  },
  {
    v: 'full', label: 'Whole day',
    steps: [step('wake-up', '7:00'), step('breakfast', '7:30'), step('writing', '8:30'), step('math'), step('snack', '9:30'), step('outside'), step('lunch', '12:00'), step('quiet-time', '12:30'), step('art'), step('play'), step('bath', '6:30'), step('bedtime', '7:30')],
  },
  {
    v: 'short', label: 'Short learning time',
    steps: [step('writing'), step('math'), step('art'), step('snack'), step('story'), step('outside')],
  },
  {
    v: 'bedtime', label: 'Bedtime routine', routine: 'bedtime',
    steps: [step('bath', '6:45'), step('pajamas'), step('potty'), step('brush-teeth'), step('story', '7:05'), step('hug'), step('lights-out', '7:30')],
  },
  {
    v: 'bedtime-short', label: 'Short bedtime (no bath)', routine: 'bedtime',
    steps: [step('pajamas'), step('potty'), step('brush-teeth'), step('story'), step('lights-out')],
  },
  {
    v: 'morning-school', label: 'School morning routine', routine: 'morning',
    steps: [step('wake-up', '6:45'), step('potty'), step('get-dressed'), step('breakfast', '7:00'), step('brush-teeth'), step('brush-hair'), step('shoes'), step('coat'), step('backpack', '7:35')],
  },
  {
    v: 'morning-home', label: 'Home morning routine', routine: 'morning',
    steps: [step('wake-up', '7:00'), step('potty'), step('wash-hands'), step('get-dressed'), step('make-bed'), step('breakfast', '7:30'), step('brush-teeth'), step('play')],
  },
  {
    v: 'potty-chair', label: 'Potty chair steps', routine: 'potty',
    steps: [step('underwear'), { icon: 'potty', label: 'Sit on the potty', time: '' }, step('toilet-paper'), step('pants-up'), { icon: 'flush', label: 'Flush or dump', time: '' }, step('wash-hands'), step('towel')],
  },
  {
    v: 'potty-toilet', label: 'Big toilet steps', routine: 'potty',
    steps: [step('step-stool'), step('underwear'), step('toilet'), step('toilet-paper'), step('pants-up'), step('flush'), step('wash-hands'), step('towel')],
  },
  {
    v: 'potty-short', label: 'First potty steps (short)', routine: 'potty',
    steps: [{ icon: 'potty', label: 'Sit on the potty', time: '' }, step('flush'), step('wash-hands')],
  },
];

/** Rows on the weekly chart. */
export const SUBJECTS: { id: string; icon: string; label: string }[] = [
  { id: 'letters', icon: 'writing', label: 'Letters' },
  { id: 'numbers', icon: 'math', label: 'Numbers' },
  { id: 'read', icon: 'story', label: 'Read aloud' },
  { id: 'art', icon: 'art', label: 'Art and fine motor' },
  { id: 'outside', icon: 'outside', label: 'Outside time' },
  { id: 'music', icon: 'music', label: 'Music and movement' },
  { id: 'puzzles', icon: 'puzzles', label: 'Puzzles and games' },
  { id: 'helping', icon: 'clean-up', label: 'Helping at home' },
];
export const DEFAULT_SUBJECTS = ['letters', 'numbers', 'read', 'art', 'outside', 'music'];

export const MAX_STEPS = 12;
export const MAX_LABEL = 24;
const CARDS = 12;

// ---------- Pictures ----------

let icons: Record<string, string> | null = null;
let pending: Promise<void> | null = null;
export type IconFetcher = (url: string) => Promise<string>;
const defaultFetch: IconFetcher = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); });

/** Loads the routine pictures once. Pages drawn before they arrive show a plain star in each picture box. */
export function loadScheduleIcons(fetcher: IconFetcher = defaultFetch): Promise<void> {
  if (icons) return Promise.resolve();
  pending ??= fetcher('/schedule/routine.json')
    .then((t) => { icons = (JSON.parse(t) as { icons: Record<string, string> }).icons; })
    .catch(() => { pending = null; });
  return pending;
}
export const scheduleIconsReady = () => icons !== null;
export const scheduleIconUrl = (icon: string) => `/schedule/icons/${icon}.svg`;

const INK = COLORS.ink;
const SOFT = '#f4f7fc';
const f2 = (n: number) => Math.round(n * 100) / 100;

function placePath(d: string, cx: number, cy: number, size: number): string {
  const s = size / 1000;
  const ox = cx - size / 2, oy = cy - size / 2;
  let i = 0;
  return d.replace(/-?\d+(?:\.\d+)?/g, (m) => f2(Number(m) * s + (i++ % 2 === 0 ? ox : oy)).toString());
}
function drawIcon(items: Item[], id: string, cx: number, cy: number, size: number) {
  const d = icons?.[id];
  if (d) items.push({ kind: 'path', d: placePath(d, cx, cy, size), color: INK, width: 0, fill: INK, evenOdd: true });
  else items.push({ kind: 'path', d: starPath(cx, cy, size * 0.4), color: INK, width: 1.4, fill: '#ffffff' });
}

// ---------- Text helpers ----------

/** Labels and times as they print: plain text, no line breaks, short enough for a card. */
export const cleanLabel = (s: string, max = MAX_LABEL) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[‘’]/g, "'").replace(/[^A-Za-z0-9 '&.,:!?/()+-]/g, '').replace(/\s+/g, ' ').trim().slice(0, max).trim();
export const cleanTime = (s: string) => s.replace(/[^0-9:apmAPM .]/g, '').replace(/\s+/g, ' ').trim().slice(0, 8).trim();

/** The largest size from `size` down to `min` at which the text fits `maxW`. */
function fitSize(t: string, size: number, maxW: number, min: number) {
  let s = size;
  while (s > min && textW(t, s) > maxW) s -= 0.5;
  return s;
}
/** Text that never runs past maxW: shrunk to `min`, then cut with a period-free ellipsis as a last resort. */
function fitText(t: string, size: number, maxW: number, min: number): { text: string; size: number } {
  const s = fitSize(t, size, maxW, min);
  if (textW(t, s) <= maxW) return { text: t, size: s };
  let cut = t;
  while (cut.length > 1 && textW(cut + '...', s) > maxW) cut = cut.slice(0, -1);
  return { text: cut.trimEnd() + '...', size: s };
}

/** One line if it fits at `size`, else two lines split near the middle word, shrunk together only if needed. */
function wrapLabel(t: string, size: number, maxW: number, min: number): { lines: string[]; size: number } {
  if (textW(t, size) <= maxW) return { lines: [t], size };
  const words = t.split(' ');
  if (words.length < 2) { const f = fitText(t, size, maxW, min); return { lines: [f.text], size: f.size }; }
  let best: string[] = [t];
  let bestW = Infinity;
  for (let k = 1; k < words.length; k++) {
    const ls = [words.slice(0, k).join(' '), words.slice(k).join(' ')];
    const wMax = Math.max(...ls.map((l) => textW(l, size)));
    if (wMax < bestW) { bestW = wMax; best = ls; }
  }
  const sz = Math.min(...best.map((l) => fitSize(l, size, maxW, min)));
  return { lines: best.map((l) => fitText(l, sz, maxW, min).text), size: sz };
}

/** "Maya's Day", "James's Week". The full name if it fits, the first name if not, else the fallback. */
function titleFor(name: string, what: string, fallback: string, size: number, maxW: number, min: number): { text: string; size: number } {
  // Never cut a name mid-word: a name longer than the tools allow (24 characters) uses the first name only.
  const all = cleanName(name, 80).split(' ').filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1));
  const full = all.join(' ');
  const make = (n: string) => `${n}'s ${what}`;
  if (!full) return { text: fallback, size: fitSize(fallback, size, maxW, min) };
  for (const n of full.length <= 24 ? [full, all[0]] : [all[0]]) {
    const t = make(n);
    const s = fitSize(t, size, maxW, min);
    if (textW(t, s) <= maxW) return { text: t, size: s };
  }
  return fitText(make(full.split(/\s+/)[0]), size, maxW, min);
}

const LABELS: Record<ScheduleKind, string> = {
  day: 'Preschool daily schedule',
  cards: 'Preschool schedule cards',
  week: 'Preschool homeschool week',
  stickers: 'Potty sticker chart',
};
const BEDTIME_LABELS: Record<ScheduleKind, string> = {
  day: 'Bedtime routine chart',
  cards: 'Bedtime routine cards',
  week: 'Preschool homeschool week',
  stickers: 'Potty sticker chart',
};
const MORNING_LABELS: Record<ScheduleKind, string> = {
  day: 'Morning routine chart',
  cards: 'Morning routine cards',
  week: 'Preschool homeschool week',
  stickers: 'Potty sticker chart',
};
const POTTY_LABELS: Record<ScheduleKind, string> = {
  day: 'Potty steps chart',
  cards: 'Potty picture cards',
  week: 'Preschool homeschool week',
  stickers: 'Potty sticker chart',
};
/** Title words for the day list and the cards: "Maya's Morning", "Maya's morning cards". */
const TITLES: Record<Routine, { day: string; myDay: string; cards: string; myCards: string }> = {
  day: { day: 'Day', myDay: 'My Day', cards: 'schedule cards', myCards: 'Schedule cards' },
  bedtime: { day: 'Bedtime', myDay: 'My Bedtime', cards: 'bedtime cards', myCards: 'Bedtime cards' },
  morning: { day: 'Morning', myDay: 'My Morning', cards: 'morning cards', myCards: 'Morning cards' },
  potty: { day: 'Potty Steps', myDay: 'My Potty Steps', cards: 'potty cards', myCards: 'Potty cards' },
};

// ---------- Pages ----------

/** The day in order: one row per step with its picture, words, time and a box to check off. */
function dayPage(o: ScheduleOptions, w: number, h: number): Page {
  const items: Item[] = [];
  const steps = o.steps.slice(0, MAX_STEPS);
  const tt = TITLES[o.routine ?? 'day'];
  const t = titleFor(o.name, tt.day, tt.myDay, 30, w - 2 * M, 18);
  items.push({ kind: 'text', x: w / 2, y: M + 34, size: t.size, text: t.text, color: INK, align: 'center' });
  const top = M + 58;
  const bottom = h - M - 24;
  const n = Math.max(steps.length, 1);
  const gap = n > 8 ? 6 : 8;
  const rowH = Math.min(118, (bottom - top) / n);
  const boxH = rowH - gap;
  const pic = boxH; // square picture box at the left
  const check = Math.min(34, boxH * 0.5);
  const labelSize = Math.max(14, Math.min(30, boxH * 0.34));
  const timeSize = Math.max(11, labelSize * 0.72);
  steps.forEach((s, i) => {
    const y = top + i * rowH;
    items.push({ kind: 'path', d: box(M, y, w - 2 * M, boxH, 10), color: COLORS.guide, width: 1.4 });
    items.push({ kind: 'path', d: box(M, y, pic, boxH, 10), color: COLORS.guide, width: 1.4, fill: SOFT });
    drawIcon(items, s.icon, M + pic / 2, y + boxH / 2, pic * 0.76);
    // Check-off box at the right, the time just left of it.
    const cx = w - M - 14 - check;
    items.push({ kind: 'path', d: box(cx, y + (boxH - check) / 2, check, check, 5), color: INK, width: 1.4 });
    const time = cleanTime(s.time);
    let right = cx - 14;
    if (time) {
      items.push({ kind: 'text', x: right, y: y + boxH / 2 + timeSize * 0.36, size: timeSize, text: time, color: COLORS.quiet, align: 'right' });
      right -= textW(time, timeSize) + 14;
    }
    const lx = M + pic + 16;
    const label = fitText(cleanLabel(s.label) || activityLabel(s.icon), labelSize, right - lx, 12);
    items.push({ kind: 'text', x: lx, y: y + boxH / 2 + label.size * 0.36, size: label.size, text: label.text, color: INK, align: 'left' });
  });
  footer(items, w, h, o.credit, scheduleLabel('day', o.routine));
  return { w, h, items };
}

/** 12 picture cards with dashed cut lines. Unused cards are left blank to draw on. */
function cardsPage(o: ScheduleOptions, w: number, h: number): Page {
  const items: Item[] = [];
  const steps = o.steps.slice(0, CARDS);
  const tt = TITLES[o.routine ?? 'day'];
  const t = titleFor(o.name, tt.cards, tt.myCards, 18, w - 2 * M, 12);
  items.push({ kind: 'text', x: M, y: M + 16, size: t.size, text: t.text, color: INK, align: 'left' });
  items.push({ kind: 'text', x: w - M, y: M + 16, size: 10, text: 'Cut on the dashed lines.', color: COLORS.quiet, align: 'right' });
  const cols = 3, rows = 4;
  const top = M + 30;
  const bottom = h - M - 22;
  const cw = (w - 2 * M) / cols;
  const ch = (bottom - top) / rows;
  const cut = { color: COLORS.quiet, width: 0.8, dash: [5, 4] };
  for (let r = 0; r <= rows; r++) items.push({ kind: 'line', x1: M, y1: top + r * ch, x2: w - M, y2: top + r * ch, ...cut });
  for (let c = 0; c <= cols; c++) items.push({ kind: 'line', x1: M + c * cw, y1: top, x2: M + c * cw, y2: bottom, ...cut });
  const pad = 10;
  const labelSize = 17;
  for (let k = 0; k < CARDS; k++) {
    const x = M + (k % cols) * cw, y = top + Math.floor(k / cols) * ch;
    items.push({ kind: 'path', d: box(x + pad, y + pad, cw - 2 * pad, ch - 2 * pad, 10), color: COLORS.guide, width: 1.4 });
    const s = steps[k];
    const labelY = y + ch - pad - 16;
    if (!s) {
      // A blank card: room to draw, a line to write on.
      items.push({ kind: 'line', x1: x + pad + 16, y1: labelY, x2: x + cw - pad - 16, y2: labelY, color: COLORS.quiet, width: 0.75 });
      continue;
    }
    const time = cleanTime(s.time);
    const lines = wrapLabel(cleanLabel(s.label) || activityLabel(s.icon), labelSize, cw - 2 * pad - 16, 12);
    const lineH = lines.size * 1.2;
    const lastY = time ? labelY - 14 : labelY;
    const firstY = lastY - (lines.lines.length - 1) * lineH;
    const picBottom = firstY - lines.size - 4;
    const size = Math.min(cw - 2 * pad - 24, picBottom - (y + pad + 10));
    drawIcon(items, s.icon, x + cw / 2, (y + pad + 8 + picBottom) / 2, size);
    lines.lines.forEach((l, k) => items.push({ kind: 'text', x: x + cw / 2, y: firstY + k * lineH, size: lines.size, text: l, color: INK, align: 'center' }));
    if (time) items.push({ kind: 'text', x: x + cw / 2, y: labelY + 2, size: 11, text: time, color: COLORS.quiet, align: 'center' });
  }
  footer(items, w, h, o.credit, scheduleLabel('cards', o.routine));
  return { w, h, items };
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/** Monday to Friday, one row per kind of learning, with a box in each cell to write what you did. */
function weekPage(o: ScheduleOptions, w: number, h: number): Page {
  const items: Item[] = [];
  const subs = SUBJECTS.filter((s) => o.subjects.includes(s.id));
  const list = subs.length ? subs : SUBJECTS.filter((s) => DEFAULT_SUBJECTS.includes(s.id));
  const t = titleFor(o.name, 'Homeschool Week', 'Our Homeschool Week', 26, w - 2 * M, 16);
  items.push({ kind: 'text', x: M, y: M + 26, size: t.size, text: t.text, color: INK, align: 'left' });
  // "Week of" with a line, then the letter and number of the week.
  const y1 = M + 58;
  items.push({ kind: 'text', x: M, y: y1, size: 12, text: 'Week of', color: INK, align: 'left' });
  items.push({ kind: 'line', x1: M + 50, y1: y1 + 2, x2: M + 200, y2: y1 + 2, color: COLORS.quiet, width: 0.75 });
  items.push({ kind: 'text', x: M + 222, y: y1, size: 12, text: 'Letter', color: INK, align: 'left' });
  items.push({ kind: 'line', x1: M + 262, y1: y1 + 2, x2: M + 322, y2: y1 + 2, color: COLORS.quiet, width: 0.75 });
  items.push({ kind: 'text', x: M + 344, y: y1, size: 12, text: 'Number', color: INK, align: 'left' });
  items.push({ kind: 'line', x1: M + 394, y1: y1 + 2, x2: w - M, y2: y1 + 2, color: COLORS.quiet, width: 0.75 });

  const top = y1 + 20;
  const notesH = 86;
  const tableBottom = h - M - 24 - notesH - 14;
  const firstW = 128;
  const colW = (w - 2 * M - firstW) / DAYS.length;
  const headH = 26;
  const rowH = (tableBottom - top - headH) / list.length;
  const grid = { color: COLORS.guide, width: 1 };
  // Header row.
  items.push({ kind: 'path', d: box(M, top, w - 2 * M, tableBottom - top, 8), color: COLORS.guide, width: 1.4 });
  items.push({ kind: 'path', d: `M${M} ${top + headH} L${w - M} ${top + headH}`, color: COLORS.guide, width: 1.4 });
  DAYS.forEach((d, i) => {
    const x = M + firstW + i * colW;
    items.push({ kind: 'line', x1: x, y1: top, x2: x, y2: tableBottom, ...grid });
    const lab = fitText(d, 12, colW - 8, 9);
    items.push({ kind: 'text', x: x + colW / 2, y: top + 17, size: lab.size, text: lab.text, color: INK, align: 'center' });
  });
  list.forEach((s, r) => {
    const y = top + headH + r * rowH;
    if (r > 0) items.push({ kind: 'line', x1: M, y1: y, x2: w - M, y2: y, ...grid });
    const pic = Math.min(40, rowH - 14);
    drawIcon(items, s.icon, M + 8 + pic / 2, y + rowH / 2, pic);
    // Two-word labels wrap onto two lines when they don't fit beside the picture.
    const lx = M + 8 + pic + 8;
    const maxW = firstW - (lx - M) - 6;
    const lab = wrapLabel(s.label, 12, maxW, 9);
    const lh = lab.size + 3;
    const y0 = y + rowH / 2 + 4 - ((lab.lines.length - 1) * lh) / 2;
    lab.lines.forEach((l, k) => items.push({ kind: 'text', x: lx, y: y0 + k * lh, size: lab.size, text: l, color: INK, align: 'left' }));
    // A small circle to check in every day cell.
    DAYS.forEach((_, i) => {
      const x = M + firstW + i * colW;
      items.push({ kind: 'path', d: circlePath(x + colW - 12, y + 12, 6), color: COLORS.quiet, width: 1 });
    });
  });
  // Notes box.
  const ny = tableBottom + 14;
  items.push({ kind: 'path', d: box(M, ny, w - 2 * M, notesH, 8), color: COLORS.guide, width: 1.2 });
  items.push({ kind: 'text', x: M + 10, y: ny + 18, size: 11, text: 'Notes: favorite moments, new words, what to try next week', color: COLORS.quiet, align: 'left' });
  for (const k of [1, 2]) items.push({ kind: 'line', x1: M + 10, y1: ny + 18 + k * 26, x2: w - M - 10, y2: ny + 18 + k * 26, color: COLORS.desc, width: 0.75 });
  footer(items, w, h, o.credit, LABELS.week);
  return { w, h, items };
}

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** A week of sticker boxes: one row per day, a circle per try with a light star to color in, and a reward line. */
function stickersPage(o: ScheduleOptions, w: number, h: number): Page {
  const items: Item[] = [];
  const n = STICKER_BOXES.includes(o.boxes ?? 5) ? (o.boxes ?? 5) : 5;
  // Title with a star on each side.
  const starR = 15;
  // A theme puts a light picture in every circle and the theme's main picture beside the title and the reward.
  const th = o.theme && o.theme !== 'stars' && iconsReady(o.theme) ? o.theme : null;
  const pics = th ? (n >= 6 ? smallIcons(th) : THEMES[th].icons).map((i) => i.id).filter((id) => iconPath(th, id)) : [];
  const cover = th ? iconPath(th, THEMES[th].cover) : null;
  const t = titleFor(o.name, 'Potty Chart', 'My Potty Chart', 30, w - 2 * M - 4 * starR - 40, 18);
  const ty = M + 34;
  items.push({ kind: 'text', x: w / 2, y: ty, size: t.size, text: t.text, color: INK, align: 'center' });
  const half = textW(t.text, t.size) / 2;
  for (const sx of [w / 2 - half - 14 - starR, w / 2 + half + 14 + starR]) {
    if (cover) items.push({ kind: 'path', d: placePath(cover, sx, ty - t.size * 0.34, starR * 2.4), color: INK, width: 0, fill: INK, evenOdd: true });
    else items.push({ kind: 'path', d: starPath(sx, ty - t.size * 0.34, starR), color: INK, width: 1.4, fill: '#ffffff' });
  }
  items.push({ kind: 'text', x: w / 2, y: ty + 24, size: 12, text: `A sticker or a colored ${th ? 'picture' : 'star'} every time I try on the potty.`, color: COLORS.quiet, align: 'center' });

  const top = ty + 42;
  const rewardH = 74;
  const bottom = h - M - 24 - rewardH - 16;
  const firstW = 112;
  const rowH = (bottom - top) / WEEK.length;
  const colW = (w - 2 * M - firstW) / n;
  const r = Math.min(rowH, colW) / 2 - 7;
  items.push({ kind: 'path', d: box(M, top, w - 2 * M, bottom - top, 10), color: COLORS.guide, width: 1.4 });
  WEEK.forEach((d, i) => {
    const y = top + i * rowH;
    if (i > 0) items.push({ kind: 'line', x1: M, y1: y, x2: w - M, y2: y, color: COLORS.guide, width: 1 });
    if (i % 2 === 1) items.push({ kind: 'path', d: box(M + 1.5, y + 1.5, firstW - 3, rowH - 3, 0), color: SOFT, width: 0, fill: SOFT });
    const lab = fitText(d, 14, firstW - 24, 10);
    items.push({ kind: 'text', x: M + 10, y: y + rowH / 2 + lab.size * 0.36, size: lab.size, text: lab.text, color: INK, align: 'left' });
    for (let k = 0; k < n; k++) {
      const cx = M + firstW + k * colW + colW / 2, cy = y + rowH / 2;
      items.push({ kind: 'path', d: circlePath(cx, cy, r), color: COLORS.quiet, width: 1.2 });
      // Each circle a different picture from the theme, shifted one along each day so no column repeats.
      const pic = pics.length ? iconPath(th!, pics[(i + k) % pics.length]) : null;
      if (pic) items.push({ kind: 'path', d: placePath(pic, cx, cy, r * 1.42), color: COLORS.trace, width: 0, fill: COLORS.trace, evenOdd: true });
      else items.push({ kind: 'path', d: starPath(cx, cy + r * 0.06, r * 0.62), color: COLORS.guide, width: 1 });
    }
  });
  items.push({ kind: 'line', x1: M + firstW, y1: top, x2: M + firstW, y2: bottom, color: COLORS.guide, width: 1.4 });

  // The reward box: a star, the words, and the reward written in (or a line to write it).
  const ry = bottom + 16;
  items.push({ kind: 'path', d: box(M, ry, w - 2 * M, rewardH, 10), color: COLORS.guide, width: 1.4, fill: SOFT });
  if (cover) items.push({ kind: 'path', d: placePath(cover, M + 12 + 26, ry + rewardH / 2, 56), color: INK, width: 0, fill: INK, evenOdd: true });
  else drawIcon(items, 'star', M + 12 + 26, ry + rewardH / 2, 52);
  const lx = M + 80;
  items.push({ kind: 'text', x: lx, y: ry + 27, size: 14, text: 'When my chart is full, I get:', color: INK, align: 'left' });
  const lineY = ry + rewardH - 16;
  items.push({ kind: 'line', x1: lx, y1: lineY, x2: w - M - 16, y2: lineY, color: COLORS.quiet, width: 0.75 });
  // The form allows 40 characters; anything longer is cut at a whole word, never mid-word.
  const full = cleanLabel(o.reward ?? '', 200);
  const reward = full.length <= 40 ? full : full.slice(0, 41).replace(/\s+\S*$/, '');
  if (reward) {
    const f = fitText(reward, 18, w - M - 16 - lx - 4, 11);
    items.push({ kind: 'text', x: lx + 2, y: lineY - 5, size: f.size, text: f.text, color: INK, align: 'left' });
  }
  footer(items, w, h, o.credit, LABELS.stickers);
  return { w, h, items };
}

export function buildSchedulePage(o: ScheduleOptions): Page {
  const { w, h } = PAPER[o.paper];
  if (o.kind === 'stickers') return stickersPage(o, w, h);
  if (o.kind === 'cards') return cardsPage(o, w, h);
  if (o.kind === 'week') return weekPage(o, w, h);
  return dayPage(o, w, h);
}
export const scheduleLabel = (k: ScheduleKind, routine: Routine = 'day') => (routine === 'bedtime' ? BEDTIME_LABELS : routine === 'morning' ? MORNING_LABELS : routine === 'potty' ? POTTY_LABELS : LABELS)[k];
