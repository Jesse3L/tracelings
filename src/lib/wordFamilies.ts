// Word family worksheets: read, trace, hunt, sort, a word family house and a word slider for each short vowel family
// the Kindergarten plan teaches. Same page model and glyphs as the tracing tools, so every page is built in the
// browser and a child's name (if typed) never leaves the device.
import { PAPER, COLORS, styleName, type Item, type Page, type Paper } from './sheet';
import { drawText, drawCell, pitchFor, wrapToWidth } from './rowSheet';
import { M, header, footer, instruction, box, centered, huntPage, rng, circlePath, PLANS, FAMILIES, type PackOptions } from './homeschool';

export type FamilyKind = 'list' | 'trace' | 'hunt' | 'sort' | 'house' | 'slider';

export interface FamilyOptions {
  family: string; // "at"
  kind: FamilyKind;
  name: string; // may be empty; printed on the Name line only
  paper: Paper;
  credit: boolean;
  seed: number; // "New words" bumps this (hunt and sort)
}

export const FAMILY_KINDS: { v: FamilyKind; label: string; sub: string }[] = [
  { v: 'list', label: 'Read the words', sub: 'The word list and short sentences to read' },
  { v: 'trace', label: 'Trace the words', sub: 'Each word on handwriting lines, then write it' },
  { v: 'hunt', label: 'Word hunt', sub: 'Read every word, circle the ones in the family' },
  { v: 'sort', label: 'Word sort', sub: 'Two families: write each word in its column' },
  { v: 'house', label: 'Word family house', sub: 'Add a first letter, trace the ending, read it' },
  { v: 'slider', label: 'Word slider', sub: 'Cut out, slide the strip, read new words' },
];

export interface FamilyInfo {
  slug: string; // "at"
  vowel: 'a' | 'e' | 'i' | 'o' | 'u';
  words: string[]; // every word on the pages (plan words first)
  sentences: string[]; // short sentences built from the family and early sight words
  sight: string; // which family words are also Dolch sight words
  tricky: { q: string; a: string }; // the word that looks or sounds like it belongs but doesn't (or a sound tip)
  stretch: string[]; // blends and digraphs for later
  tip: string; // one idea away from the paper
}

// Plan words come first (FAMILIES in homeschool.ts), then a few more real CVC words a five year old might know.
const extra: Record<string, string[]> = {
  at: ['pat'], an: ['tan'], ap: ['gap', 'yap'], ag: ['sag'], ig: ['jig'], it: ['pit', 'lit'], in: [],
  ip: ['rip', 'tip'], op: [], ot: ['not', 'got'], og: [], ug: ['dug'], un: [], ut: [],
  en: [], et: ['set', 'vet', 'let', 'yet'], ed: ['wed'],
};

export const FAMILY_INFO: FamilyInfo[] = [
  { slug: 'at', vowel: 'a', words: [], sentences: ['The cat sat on a mat.', 'A rat has a hat.', 'Pat the cat.'],
    sight: '"at" is a word on its own, and it is on the Dolch primer sight word list. "That" is on the same list once your child knows the th sound.',
    tricky: { q: 'Is "what" an -at word?', a: 'No. "What" ends in the letters a and t, but it rhymes with "but," not with "cat." Leave it out of -at practice and teach it as a sight word.' },
    stretch: ['that', 'flat', 'chat', 'splat'],
    tip: 'Line up a toy cat, a hat and a bath mat. Say each word slowly, then say only the ending: -at, -at, -at.' },
  { slug: 'an', vowel: 'a', words: [], sentences: ['The man ran to the van.', 'A fan is in the van.', 'I can see a pan.'],
    sight: '"can" is a Dolch pre-primer word and "ran" is on the primer list, so this family gives sight word practice for free.',
    tricky: { q: 'Why do -an and -at get mixed up?', a: 'They only differ by the last sound. Read pairs side by side, like cat and can, mat and man, rat and ran, and have your child point to the last letter as they say it.' },
    stretch: ['plan', 'than', 'scan', 'clan'],
    tip: 'Turn on a fan, find a pan in the kitchen, and spot a van on a walk. Each time, ask which family the word belongs to.' },
  { slug: 'ap', vowel: 'a', words: [], sentences: ['The cap is on the map.', 'A cat can nap on my lap.', 'Tap the cap.'],
    sight: 'None of the -ap words are on the Dolch lists, which makes this a good week to read by sound alone.',
    tricky: { q: 'Is "map" hard to tell apart from "mat"?', a: 'Often, yes. The p and the t are both short, quiet sounds. Say the pair slowly and have your child watch your lips: they close for p and stay open for t.' },
    stretch: ['clap', 'snap', 'trap', 'flap'],
    tip: 'Act out the doing words: nap, tap, clap and snap. Your child reads the card, then does the action.' },
  { slug: 'ag', vowel: 'a', words: [], sentences: ['The rag is in the bag.', 'The dog can wag.', 'Put a tag on the bag.'],
    sight: 'No -ag words are Dolch words. The sentences add "the," "is" and "in," which your child may already know.',
    tricky: { q: 'Why does the g sound so short at the end?', a: 'At the end of a word, g is a quick, hard sound. Some kids add an extra "uh" (bag-uh). Model it crisp and short, and it usually settles on its own.' },
    stretch: ['flag', 'drag', 'snag', 'brag'],
    tip: 'Play a quick game of tag in the yard, then pack three things in a bag and read their names off sticky notes.' },
  { slug: 'ig', vowel: 'i', words: [], sentences: ['The pig can dig.', 'A big wig is on the pig.', 'I can dig.'],
    sight: '"big" is a Dolch pre-primer word, so many kids already know one word in this family before they start.',
    tricky: { q: 'Why does my child read "pig" as "peg"?', a: 'Short i and short e sound close, and many kids mix them up at first. Say "i, itchy" and scratch your arm for short i. A body motion like that helps the sounds stay apart.' },
    stretch: ['twig'],
    tip: 'Dig in a sandbox or a bin of rice for letter cards. Each card your child finds goes in front of -ig to make a word.' },
  { slug: 'it', vowel: 'i', words: [], sentences: ['Sit on the mat.', 'The bat hit it.', 'I can sit in it.'],
    sight: '"it" is a word on its own and a Dolch pre-primer word. "sit" is on the second grade list.',
    tricky: { q: 'Is "bite" an -it word?', a: 'Not yet. The silent e at the end changes the vowel to a long i, so bite rhymes with kite. Keep this family to short words like bit and sit for now.' },
    stretch: ['skit', 'spit', 'grit', 'split'],
    tip: 'Play "sit if it fits": say a word, and your child sits down only if it ends in -it.' },
  { slug: 'in', vowel: 'i', words: [], sentences: ['The pin is in the bin.', 'A fish has a fin.', 'I can win.'],
    sight: '"in" is a Dolch pre-primer word, so the family starts from a word most kids have seen in books.',
    tricky: { q: 'Do "pin" and "pen" sound the same?', a: 'In some parts of the United States, especially the South, they sound almost alike, and that is a normal accent. Point to the letter i as you read so your child links the spelling to the word.' },
    stretch: ['chin', 'thin', 'spin', 'grin'],
    tip: 'Sort a handful of coins or buttons into a tin. Every time one drops in, say an -in word.' },
  { slug: 'ip', vowel: 'i', words: [], sentences: ['Zip up the bag.', 'Tip the cup and sip.', 'I dip it in.'],
    sight: 'None of the -ip words are Dolch words. "up" in the sentences is a pre-primer word.',
    tricky: { q: 'Why does "lip" turn into "lap"?', a: 'Kids sometimes fall back on the short a they learned first. Read lip and lap side by side and ask which one is on their face.' },
    stretch: ['ship', 'chip', 'trip', 'skip'],
    tip: 'Snack time: sip water, dip a cracker, zip the lunch bag. Name each -ip action as you do it.' },
  { slug: 'op', vowel: 'o', words: [], sentences: ['Hop to the top.', 'Mop it up.', 'The top can pop.'],
    sight: 'No -op words are on the Dolch lists. The sentences use "to," "the" and "up."',
    tricky: { q: 'Is "hope" in the -op family?', a: 'No. A silent e changes hop to hope and makes the o say its name. That comes later, in first grade for many kids. For now, -op words all have the short o sound.' },
    stretch: ['stop', 'shop', 'drop', 'flop'],
    tip: 'Hop on one foot for each -op word your child reads. Ten hops means ten words.' },
  { slug: 'ot', vowel: 'o', words: [], sentences: ['The pot is hot.', 'A dot is on the cot.', 'It is not hot.'],
    sight: '"not" is a Dolch pre-primer word, and "got" and "hot" are on the third grade list, so this family carries a lot of sight word practice.',
    tricky: { q: 'Why does my child read "hot" and "hat" the same?', a: 'Short o and short a can sound close. Open your mouth wide like a doctor visit and say "ah" for short o. Then read hot and hat side by side.' },
    stretch: ['spot', 'shot', 'trot', 'plot'],
    tip: 'Make dots with a marker or stickers. Each dot gets an -ot word read out loud before it goes on the page.' },
  { slug: 'og', vowel: 'o', words: [], sentences: ['The dog can jog.', 'A hog sat on a log.', 'The fog is big.'],
    sight: 'None of the -og words are Dolch words. "dog" is on the Dolch noun list, a separate list of 95 picture words.',
    tricky: { q: 'Why does "dog" sound different from "hot" when we say it?', a: 'In many American accents the o in dog is a little longer than the o in hot. Both are fine. What matters for reading is the -og ending.' },
    stretch: ['frog', 'clog', 'smog'],
    tip: 'Go for a short jog and look for a log, a dog or some fog. Read the word on a card when you get home.' },
  { slug: 'ug', vowel: 'u', words: [], sentences: ['The bug is on the rug.', 'A bug is in the mug.', 'Tug the rug.'],
    sight: 'No -ug words are on the Dolch lists, so this is a sound-it-out week.',
    tricky: { q: 'Why is short u tricky?', a: 'Short u is a soft, relaxed sound, close to the "uh" we say when we pause. Some kids read it as short o. Say "u, up" and point your thumb up as a reminder.' },
    stretch: ['plug', 'snug', 'slug', 'shrug'],
    tip: 'Give a hug for every -ug word your child reads. Tug a rope or a towel for the next one.' },
  { slug: 'un', vowel: 'u', words: [], sentences: ['Run in the sun.', 'It is fun to run.', 'I see a bun.'],
    sight: '"run" is a Dolch pre-primer word, so many kids can already read one word in this family.',
    tricky: { q: 'Are "one" and "done" -un words?', a: 'They rhyme with sun, but they are spelled another way. Keep them out of the family and teach "one" as a sight word.' },
    stretch: ['spun', 'stun', 'shun'],
    tip: 'Run in the sun to the end of the yard and back. Each lap, your child reads one -un card.' },
  { slug: 'ut', vowel: 'u', words: [], sentences: ['Cut the nut.', 'The nut is in the hut.', 'I cut it but it is big.'],
    sight: '"but" is a Dolch primer word, so this family doubles as sight word practice.',
    tricky: { q: 'Is "put" an -ut word?', a: 'No, even though it looks like one. "Put" rhymes with "foot." It is a Dolch first grade word, so teach it as a sight word and keep it off the -ut list.' },
    stretch: ['shut', 'strut'],
    tip: 'Cut paper strips with child-safe scissors. Write one -ut word on each strip and read it before you cut the next.' },
  { slug: 'en', vowel: 'e', words: [], sentences: ['The hen is in the den.', 'Ten men ran.', 'A pen is red.'],
    sight: '"ten" is on the Dolch third grade list, and "then" and "when" (first grade) join the family once your child knows th and wh.',
    tricky: { q: 'Do "pen" and "pin" sound the same?', a: 'In some accents they sound almost alike, which is normal. Point to the e as you read, and say "e, egg" to anchor the short e sound.' },
    stretch: ['then', 'when', 'glen'],
    tip: 'Count to ten with pens or crayons in a cup, then read the word "ten" on a card.' },
  { slug: 'et', vowel: 'e', words: [], sentences: ['The pet is wet.', 'Get the jet.', 'The vet has a net.'],
    sight: '"get" is a Dolch primer word and "let" is on the first grade list.',
    tricky: { q: 'Why does my child read "net" as "nut"?', a: 'Short e and short u are close for many new readers. Say "e, egg" and "u, up" with the motions, then read net and nut side by side.' },
    stretch: ['fret'],
    tip: 'Make a net from a colander or a laundry basket and toss in socks. Read an -et word for each catch.' },
  { slug: 'ed', vowel: 'e', words: [], sentences: ['The bed is red.', 'I fed my pet.', 'Red is on the bed.'],
    sight: '"red" is a Dolch pre-primer color word, so this family usually starts with a quick win.',
    tricky: { q: 'Is "said" an -ed word?', a: 'It rhymes with bed but it is spelled another way, so keep it off the list and teach it as a sight word. The -ed at the end of doing words, like jumped, is a different thing that comes later.' },
    stretch: ['sled', 'shed', 'fled', 'sped'],
    tip: 'Find red things around the house and put them on a bed. Read "red" and "bed" on cards at the end.' },
].map((f) => ({ ...f, words: [...FAMILIES[f.slug], ...(extra[f.slug] ?? [])] })) as FamilyInfo[];

export const familyInfo = (slug: string) => FAMILY_INFO.find((f) => f.slug === slug)!;
export const FAMILY_SLUGS = FAMILY_INFO.map((f) => f.slug);

/** The Kindergarten plan week that teaches a family, and the short vowel review after it. */
export function planWeeks(slug: string) {
  const weeks = PLANS.kindergarten.weeks;
  return { week: weeks.find((w) => w.family === slug)!, review: weeks.find((w) => w.kind === 'vowel-review' && w.families!.includes(slug))! };
}

/** Families with the same short vowel, in plan order. The sort page pairs each family with the next one. */
export const sameVowel = (slug: string) => FAMILY_INFO.filter((f) => f.vowel === familyInfo(slug).vowel).map((f) => f.slug);
export function partnerOf(slug: string): string {
  const set = sameVowel(slug);
  return set[(set.indexOf(slug) + 1) % set.length];
}
/** The first letter(s) that turn the ending into each word: c, b, h ... for -at. */
export const onsets = (f: FamilyInfo) => f.words.map((w) => w.slice(0, w.length - f.slug.length));

const INK = COLORS.ink;
const f2 = (n: number) => Math.round(n * 100) / 100;
const CUT = [6, 4];

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Name/Date header, with the child's name on the line when one is typed. */
function start(o: FamilyOptions) {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  header(items, w);
  writeName(items, o.name);
  return { w, h, items };
}
function writeName(items: Item[], name: string) {
  const who = styleName(name, 'capital');
  if (who) items.push({ kind: 'text', x: M + 44, y: 53, size: 14, text: who, color: INK, align: 'left' });
}
const labelFor = (o: FamilyOptions) => `Word family -${o.family}: ${FAMILY_KINDS.find((k) => k.v === o.kind)!.label.toLowerCase()}`;

/** Read the words: the family in big letters with three boxes to color (one per reading), then sentences to read. */
function listPage(o: FamilyOptions): Page {
  const f = familyInfo(o.family);
  const { w, h, items } = start(o);
  let y = instruction(items, w, `Read the -${f.slug} words`, 'Point to each word and read it out loud. Color a box each time you read it.') + 8;
  const cols = 2;
  const rows = Math.ceil(f.words.length / cols);
  const colW = (w - 2 * M) / cols;
  const rowH = Math.min(62, (h * 0.5) / rows);
  const cap = Math.min(36, rowH * 0.6);
  f.words.forEach((word, i) => {
    const c = Math.floor(i / rows), r = i % rows;
    const x = M + c * colW + 8;
    const base = y + r * rowH + cap + 6;
    drawText(items, word, x, base, cap, 'model', false);
    const bx = x + colW - 44 - 3 * 26; // keep a clear gutter before the next column
    for (let k = 0; k < 3; k++) items.push({ kind: 'path', d: box(bx + k * 26, base - 18, 18, 18, 3), color: INK, width: 1.2 });
  });
  y += rows * rowH + 22;
  items.push({ kind: 'line', x1: M, y1: y, x2: w - M, y2: y, color: COLORS.desc, width: 1 });
  items.push({ kind: 'text', x: M, y: y + 26, size: 15, text: 'Read the sentences', color: INK, align: 'left' });
  y += 44;
  const sCap = 26;
  for (const s of f.sentences) {
    for (const line of wrapToWidth(s, (w - 2 * M - 30) / sCap)) {
      items.push({ kind: 'path', d: circlePath(M + 6, y + sCap * 0.55, 5), color: INK, width: 1.2 });
      drawText(items, line, M + 24, y + sCap, sCap, 'model', false);
      y += sCap * 1.9;
    }
  }
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

/** Trace the words: one word per row, solid model first, traced copies, room at the end to write it alone. */
function tracePage(o: FamilyOptions): Page {
  const f = familyInfo(o.family);
  const { w, h, items } = start(o);
  let y = instruction(items, w, `Trace the -${f.slug} words`, 'Read the word, then trace it. Write it once on your own at the end of the row.') + 14;
  const cap = 40;
  const pitch = pitchFor(cap);
  const bottom = h - M - 22;
  for (let i = 0; y + cap * 1.5 <= bottom; i++) {
    drawCell(items, f.words[i % f.words.length], M, w - M, y, cap, { practice: 'trace-write', startDots: true, model: true });
    y += pitch;
  }
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

/** Word hunt: the family mixed with words from the other families that share its vowel, so the ending has to be read. */
function familyHunt(o: FamilyOptions): Page {
  const f = familyInfo(o.family);
  const pool = sameVowel(f.slug).filter((s) => s !== f.slug).flatMap((s) => familyInfo(s).words);
  const pack = { paper: o.paper, credit: o.credit } as PackOptions;
  const p = huntPage(pack, f.words, pool, `Find the -${f.slug} words`, `Read each word. Circle the words that end in -${f.slug}.`, labelFor(o), `wf-${f.slug}-${o.seed}`);
  writeName(p.items, o.name);
  return p;
}

/** Word sort: eight words in a bank, two columns headed by the endings, handwriting lines to write each word. */
function sortPage(o: FamilyOptions): Page {
  const f = familyInfo(o.family);
  const g = familyInfo(partnerOf(f.slug));
  const { w, h, items } = start(o);
  let y = instruction(items, w, `Sort the words: -${f.slug} or -${g.slug}?`, `Read each word in the box. Write it under -${f.slug} or -${g.slug}, the ending it has.`) + 12;
  const rand = rng(`sort-${f.slug}-${o.seed}`);
  const pick = (x: FamilyInfo) => shuffle(x.words, rand).slice(0, 4);
  const bank = shuffle([...pick(f), ...pick(g)], rand);
  // Word bank: two rows of four.
  const bw = (w - 2 * M - 3 * 12) / 4, bh = 52;
  items.push({ kind: 'path', d: box(M - 8, y - 8, w - 2 * M + 16, 2 * bh + 12 + 16, 10), color: COLORS.desc, width: 1 });
  bank.forEach((word, i) => {
    const c = i % 4, r = Math.floor(i / 4);
    const x = M + c * (bw + 12), yy = y + r * (bh + 12);
    items.push({ kind: 'path', d: box(x, yy, bw, bh, 6), color: INK, width: 1.2 });
    centered(items, word, x + bw / 2, yy + bh / 2 + 12, 30);
  });
  y += 2 * bh + 12 + 40;
  // Two columns.
  const gap = 24;
  const colW = (w - 2 * M - gap) / 2;
  const cap = 34;
  const pitch = pitchFor(cap);
  const rows = Math.max(4, Math.min(5, Math.floor((h - M - 30 - (y + 60)) / pitch)));
  [f, g].forEach((x, c) => {
    const x1 = M + c * (colW + gap);
    items.push({ kind: 'path', d: box(x1, y, colW, 52 + rows * pitch + 8, 10), color: INK, width: 1.4 });
    centered(items, `-${x.slug}`, x1 + colW / 2, y + 40, 32);
    items.push({ kind: 'line', x1, y1: y + 52, x2: x1 + colW, y2: y + 52, color: INK, width: 1.2 });
    for (let r = 0; r < rows; r++) drawCell(items, '', x1 + 10, x1 + colW - 10, y + 66 + r * pitch, cap, { practice: 'trace', startDots: false, model: false });
  });
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

/** Word family house: the ending in the roof, one row per first letter. The child writes the letter, traces the ending and reads the word. */
function housePage(o: FamilyOptions): Page {
  const f = familyInfo(o.family);
  const { w, h, items } = start(o);
  const top = instruction(items, w, `My -${f.slug} word family house`, `Write a letter from the list in each box and trace -${f.slug}. Read the word, then write it on the rest of the line.`) + 8;
  const ons = onsets(f).slice(0, 6);
  const bankH = 64;
  const bottom = h - M - 26 - bankH;
  const roofH = 104;
  const bodyX = M + 34, bodyW = w - 2 * M - 68;
  const bodyTop = top + roofH;
  const cap = 34;
  const pitch = pitchFor(cap);
  // Rows fill the body; the body is only as tall as its rows.
  const rows = Math.min(ons.length, Math.floor((bottom - bodyTop - 24 - cap * 1.5) / pitch) + 1);
  const bodyH = 24 + (rows - 1) * pitch + cap * 1.5 + 22;
  // Roof (with eaves) and body, plus a chimney.
  items.push({ kind: 'path', d: `M${f2(bodyX + bodyW * 0.72)} ${f2(top + roofH * 0.36)} V${f2(top + 6)} H${f2(bodyX + bodyW * 0.8)} V${f2(top + roofH * 0.48)}`, color: INK, width: 2, fill: '#ffffff' });
  items.push({ kind: 'path', d: `M${f2(bodyX - 22)} ${f2(bodyTop)} L${f2(w / 2)} ${f2(top)} L${f2(bodyX + bodyW + 22)} ${f2(bodyTop)} Z`, color: INK, width: 2, fill: '#ffffff' });
  items.push({ kind: 'path', d: `M${f2(bodyX)} ${f2(bodyTop)} H${f2(bodyX + bodyW)} V${f2(bodyTop + bodyH)} H${f2(bodyX)} Z`, color: INK, width: 2 });
  centered(items, `-${f.slug}`, w / 2, bodyTop - 18, 46);
  // Rows: [box for the first letter][traced ending] then space to write the whole word.
  const x1 = bodyX + 18, x2 = bodyX + bodyW - 18;
  for (let r = 0; r < rows; r++) {
    const yTop = bodyTop + 24 + r * pitch;
    drawCell(items, '', x1, x2, yTop, cap, { practice: 'trace', startDots: false, model: false });
    const bw = cap * 0.95;
    items.push({ kind: 'path', d: box(x1 + 8, yTop - 4, bw, cap + 8, 4), color: INK, width: 1.4, fill: '#ffffff' });
    drawText(items, f.slug, x1 + 8 + bw + cap * 0.12, yTop + cap, cap, 'trace', true);
  }
  // Letter bank.
  const by = bodyTop + bodyH + 26;
  items.push({ kind: 'text', x: M, y: by + 8, size: 12, text: 'Letters to use:', color: COLORS.quiet, align: 'left' });
  const startX = M + 96, step = Math.min(56, (w - M - startX) / Math.max(1, ons.length));
  ons.forEach((l, i) => {
    const cx = startX + i * step + 20;
    items.push({ kind: 'path', d: circlePath(cx, by, 19), color: INK, width: 1.3 });
    centered(items, l, cx, by + 10, 26);
  });
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

/** Word slider: a card with the ending and two slits, a strip of first letters to thread through, and lines to write the words made. */
function sliderPage(o: FamilyOptions): Page {
  const f = familyInfo(o.family);
  const { w, h, items } = start(o);
  let y = instruction(items, w, `-${f.slug} word slider`, 'A grown-up cuts out the card and the strip along the dashed lines, then cuts the two slits. Thread the strip in through one slit and out the other, then slide it to make new words.') + 14;
  const ons = onsets(f).slice(0, 7);
  // Card.
  const stripH = 66;
  const cardW = 380, cardH = 150;
  const cx = (w - cardW) / 2;
  items.push({ kind: 'path', d: box(cx, y, cardW, cardH, 10), color: INK, width: 1.4, dash: CUT });
  const winW = 66;
  const s1 = cx + 54, s2 = s1 + winW;
  const slitTop = y + (cardH - (stripH + 16)) / 2, slitBot = slitTop + stripH + 16;
  // The slits are dashed cut lines with a shaded window between them, so they never read as a letter l.
  items.push({ kind: 'path', d: `M${f2(s1)} ${f2(slitTop)} H${f2(s2)} V${f2(slitBot)} H${f2(s1)} Z`, color: COLORS.desc, width: 0, fill: '#eef2f8' });
  for (const sx of [s1, s2]) items.push({ kind: 'line', x1: sx, y1: slitTop, x2: sx, y2: slitBot, color: INK, width: 1.4, dash: CUT });
  items.push({ kind: 'text', x: (s1 + s2) / 2, y: slitTop - 8, size: 9, text: 'cut both slits', color: COLORS.quiet, align: 'center' });
  const capR = 72;
  drawText(items, f.slug, s2 + 26, y + cardH / 2 + capR * 0.5, capR, 'model', false);
  items.push({ kind: 'text', x: cx + cardW - 14, y: y + cardH - 12, size: 9, text: `-${f.slug} family`, color: COLORS.quiet, align: 'right' });
  y += cardH + 34;
  // Strip: a pull tab, then one letter per cell.
  const cell = 54;
  const tab = 40;
  const stripW = tab + ons.length * cell + tab;
  const sx = (w - stripW) / 2;
  items.push({ kind: 'path', d: box(sx, y, stripW, stripH, 6), color: INK, width: 1.4, dash: CUT });
  items.push({ kind: 'text', x: sx + tab / 2, y: y + stripH / 2 + 4, size: 9, text: 'pull', color: COLORS.quiet, align: 'center' });
  items.push({ kind: 'text', x: sx + stripW - tab / 2, y: y + stripH / 2 + 4, size: 9, text: 'pull', color: COLORS.quiet, align: 'center' });
  ons.forEach((l, i) => {
    const x = sx + tab + i * cell;
    items.push({ kind: 'line', x1: x, y1: y + 6, x2: x, y2: y + stripH - 6, color: COLORS.desc, width: 1 });
    centered(items, l, x + cell / 2, y + stripH / 2 + 15, 42);
  });
  items.push({ kind: 'line', x1: sx + tab + ons.length * cell, y1: y + 6, x2: sx + tab + ons.length * cell, y2: y + stripH - 6, color: COLORS.desc, width: 1 });
  y += stripH + 40;
  // Words I made.
  items.push({ kind: 'text', x: M, y, size: 15, text: 'Write the words you made', color: INK, align: 'left' });
  y += 18;
  const cap = 34;
  const pitch = pitchFor(cap);
  const bottom = h - M - 22;
  const colW = (w - 2 * M - 24) / 2;
  for (let r = 0; y + r * pitch + cap * 1.5 <= bottom; r++) {
    for (let c = 0; c < 2; c++) drawCell(items, '', M + c * (colW + 24), M + c * (colW + 24) + colW, y + r * pitch, cap, { practice: 'trace', startDots: false, model: false });
  }
  footer(items, w, h, o.credit, labelFor(o));
  return { w, h, items };
}

export function buildFamilyPage(o: FamilyOptions): Page {
  switch (o.kind) {
    case 'trace': return tracePage(o);
    case 'hunt': return familyHunt(o);
    case 'sort': return sortPage(o);
    case 'house': return housePage(o);
    case 'slider': return sliderPage(o);
    default: return listPage(o);
  }
}

/** Every page type for one family, in teaching order (members print it as one PDF). */
export const buildFamilySet = (o: FamilyOptions): Page[] => FAMILY_KINDS.map((k) => buildFamilyPage({ ...o, kind: k.v }));
