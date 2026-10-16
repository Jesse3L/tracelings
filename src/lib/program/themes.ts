// The 12 interest themes for the personalized program: labels, kid-friendly word lists and the line icons.
// Icons are original black-and-white line art traced to vector paths (public/program/icons/<theme>.json),
// so they print crisply in the PDF and the on-screen preview. Picture-grid images use the .svg files.
import type { ThemeId } from './types';

export interface ThemeIcon {
  id: string;        // file name under public/program/icons/<theme>/
  one: string;       // "T-rex"
  many: string;      // "T-rexes"
  small?: boolean;   // simple enough to read clearly when printed small (ten frames, groups of 10 or more)
  /** Other words a story or word problem may use for this picture: plurals, spellings, simple aliases
   *  ("t rex", "brachiosaurus"). `one` and `many` always count too. Only words a child would agree match the picture. */
  words?: string[];
}

export interface ThemeInfo {
  id: ThemeId;
  label: string;          // "Dinosaurs"
  short: string;          // used in sentences: "dinosaurs"
  cover: string;          // icon id for the picture grid and little book cover
  icons: ThemeIcon[];
  buddy: { one: string; icon: string };   // the friend in stories and word problems ("a little T-rex")
  cvc: string[];          // short decodable words that fit the theme (CVC where possible)
  nouns: string[];        // theme nouns for talk and stories
  place: string;          // where stories happen: "in the jungle"
}

const T = (id: ThemeId, label: string, short: string, cover: string, place: string, buddy: ThemeInfo['buddy'], icons: ThemeIcon[], cvc: string[], nouns: string[]): ThemeInfo =>
  ({ id, label, short, cover, place, buddy, icons, cvc, nouns });

export const THEMES: Record<ThemeId, ThemeInfo> = {
  dinosaurs: T('dinosaurs', 'Dinosaurs', 'dinosaurs', 't-rex', 'in dinosaur land', { one: 'little T-rex', icon: 't-rex' }, [
    { id: 't-rex', one: 'T-rex', many: 'T-rexes', words: ['t-rex', 't rex', 'trex', 'tyrannosaurus', 'dinosaur', 'dinosaurs', 'dino', 'dinos'] },
    { id: 'long-neck', one: 'long-neck dinosaur', many: 'long-neck dinosaurs', words: ['long-neck', 'long neck', 'long-necks', 'long necks', 'brachiosaurus', 'brontosaurus', 'apatosaurus'] },
    { id: 'triceratops', one: 'triceratops', many: 'triceratops', words: ['triceratops'] },
    { id: 'stegosaurus', one: 'stegosaurus', many: 'stegosauruses', words: ['stegosaurus', 'stegosauruses', 'stegosauri'] },
    { id: 'egg', one: 'dinosaur egg', many: 'dinosaur eggs', words: ['egg', 'eggs'], small: true },
    { id: 'footprint', one: 'footprint', many: 'footprints', words: ['footprint', 'footprints', 'track', 'tracks'], small: true },
    { id: 'bone', one: 'bone', many: 'bones', words: ['bone', 'bones', 'fossil', 'fossils'], small: true },
    { id: 'volcano', one: 'volcano', many: 'volcanoes', words: ['volcano', 'volcanoes', 'volcanos'] },
    { id: 'palm-tree', one: 'palm tree', many: 'palm trees', words: ['palm tree', 'palm trees', 'tree', 'trees'] },
  ], ['rex', 'egg', 'big', 'dig', 'mud', 'den', 'run', 'hot', 'sun', 'red'], ['dinosaur', 'T-rex', 'egg', 'bone', 'fossil', 'footprint', 'volcano', 'tail', 'claws']),

  trucks: T('trucks', 'Trucks and cars', 'trucks', 'dump-truck', 'on the big road', { one: 'little red truck', icon: 'dump-truck' }, [
    { id: 'dump-truck', one: 'dump truck', many: 'dump trucks', words: ['dump truck', 'dump trucks', 'truck', 'trucks', 'red truck'] },
    { id: 'fire-truck', one: 'fire truck', many: 'fire trucks', words: ['fire truck', 'fire trucks', 'fire engine', 'fire engines'] },
    { id: 'car', one: 'car', many: 'cars', words: ['car', 'cars', 'race car', 'race cars'], small: true },
    { id: 'bus', one: 'bus', many: 'buses', words: ['bus', 'buses', 'school bus'] },
    { id: 'mixer', one: 'cement mixer', many: 'cement mixers', words: ['cement mixer', 'cement mixers', 'mixer', 'mixers', 'cement truck'] },
    { id: 'digger', one: 'digger', many: 'diggers', words: ['digger', 'diggers', 'excavator', 'excavators', 'bulldozer', 'bulldozers'] },
    { id: 'tow-truck', one: 'tow truck', many: 'tow trucks', words: ['tow truck', 'tow trucks'] },
    { id: 'cone', one: 'cone', many: 'cones', words: ['cone', 'cones', 'traffic cone', 'traffic cones'], small: true },
    { id: 'traffic-light', one: 'traffic light', many: 'traffic lights', words: ['traffic light', 'traffic lights', 'stoplight', 'stop light', 'red light', 'green light', 'yellow light'], small: true },
  ], ['bus', 'van', 'cab', 'dig', 'mud', 'big', 'red', 'rig', 'go', 'stop'], ['truck', 'car', 'bus', 'digger', 'wheel', 'road', 'cone', 'driver', 'garage']),

  unicorns: T('unicorns', 'Unicorns', 'unicorns', 'unicorn', 'over the rainbow', { one: 'little unicorn', icon: 'unicorn' }, [
    { id: 'unicorn', one: 'unicorn', many: 'unicorns', words: ['unicorn', 'unicorns'] },
    { id: 'unicorn-head', one: 'unicorn', many: 'unicorns', words: ['unicorn', 'unicorns'] },
    { id: 'rainbow', one: 'rainbow', many: 'rainbows', words: ['rainbow', 'rainbows'] },
    { id: 'star', one: 'star', many: 'stars', small: true, words: ['star', 'stars'] },
    { id: 'heart', one: 'heart', many: 'hearts', words: ['heart', 'hearts'], small: true },
    { id: 'cloud', one: 'cloud', many: 'clouds', words: ['cloud', 'clouds'], small: true },
    { id: 'gem', one: 'gem', many: 'gems', words: ['gem', 'gems', 'jewel', 'jewels', 'crystal', 'crystals'], small: true },
    { id: 'wand', one: 'magic wand', many: 'magic wands', words: ['wand', 'wands', 'magic wand'] },
    { id: 'flower', one: 'flower', many: 'flowers', words: ['flower', 'flowers'], small: true },
  ], ['sun', 'fun', 'hop', 'run', 'gem', 'red', 'pink', 'mud', 'hug', 'nap'], ['unicorn', 'rainbow', 'horn', 'mane', 'star', 'cloud', 'gem', 'wand', 'sparkle']),

  ocean: T('ocean', 'Ocean animals', 'ocean animals', 'whale', 'under the sea', { one: 'little crab', icon: 'crab' }, [
    { id: 'fish', one: 'fish', many: 'fish', words: ['fish', 'fishes'], small: true },
    { id: 'whale', one: 'whale', many: 'whales', words: ['whale', 'whales'] },
    { id: 'octopus', one: 'octopus', many: 'octopuses', words: ['octopus', 'octopuses', 'octopi'] },
    { id: 'crab', one: 'crab', many: 'crabs', words: ['crab', 'crabs'], small: true },
    { id: 'turtle', one: 'sea turtle', many: 'sea turtles', words: ['sea turtle', 'sea turtles', 'turtle', 'turtles'] },
    { id: 'starfish', one: 'starfish', many: 'starfish', words: ['starfish', 'sea star', 'sea stars'], small: true },
    { id: 'shell', one: 'shell', many: 'shells', words: ['shell', 'shells', 'seashell', 'seashells'], small: true },
    { id: 'jellyfish', one: 'jellyfish', many: 'jellyfish', words: ['jellyfish', 'jelly', 'jellies'] },
    { id: 'seahorse', one: 'seahorse', many: 'seahorses', words: ['seahorse', 'seahorses', 'sea horse', 'sea horses'] },
  ], ['fin', 'net', 'wet', 'sun', 'dip', 'sand', 'crab', 'swim', 'big', 'bob'], ['fish', 'whale', 'crab', 'octopus', 'shell', 'wave', 'sand', 'seaweed', 'bubbles']),

  space: T('space', 'Space', 'space', 'rocket', 'in outer space', { one: 'little alien', icon: 'alien' }, [
    { id: 'rocket', one: 'rocket', many: 'rockets', words: ['rocket', 'rockets', 'rocket ship', 'spaceship', 'spaceships'] },
    { id: 'planet', one: 'planet', many: 'planets', words: ['planet', 'planets', 'mars', 'saturn', 'jupiter', 'venus', 'neptune', 'mercury', 'uranus', 'earth'], small: true },
    { id: 'moon', one: 'moon', many: 'moons', words: ['moon', 'moons'], small: true },
    { id: 'star', one: 'star', many: 'stars', small: true, words: ['star', 'stars'] },
    { id: 'astronaut', one: 'astronaut', many: 'astronauts', words: ['astronaut', 'astronauts', 'space suit', 'helmet'] },
    { id: 'alien', one: 'alien', many: 'aliens', words: ['alien', 'aliens'] },
    { id: 'satellite', one: 'satellite', many: 'satellites', words: ['satellite', 'satellites'] },
    { id: 'sun', one: 'sun', many: 'suns', words: ['sun', 'suns'], small: true },
    { id: 'telescope', one: 'telescope', many: 'telescopes', words: ['telescope', 'telescopes'] },
  ], ['sun', 'hot', 'big', 'top', 'zip', 'jet', 'fun', 'up', 'red', 'map'], ['rocket', 'moon', 'star', 'planet', 'astronaut', 'helmet', 'sun', 'comet', 'telescope']),

  farm: T('farm', 'Farm animals', 'farm animals', 'cow', 'on the farm', { one: 'little pig', icon: 'pig' }, [
    { id: 'cow', one: 'cow', many: 'cows', words: ['cow', 'cows', 'calf'] },
    { id: 'pig', one: 'pig', many: 'pigs', words: ['pig', 'pigs', 'piglet', 'piglets', 'hog', 'hogs'] },
    { id: 'hen', one: 'hen', many: 'hens', words: ['hen', 'hens', 'chicken', 'chickens'] },
    { id: 'sheep', one: 'sheep', many: 'sheep', words: ['sheep', 'lamb', 'lambs'] },
    { id: 'horse', one: 'horse', many: 'horses', words: ['horse', 'horses', 'pony', 'ponies'] },
    { id: 'duck', one: 'duck', many: 'ducks', words: ['duck', 'ducks', 'duckling', 'ducklings'], small: true },
    { id: 'goat', one: 'goat', many: 'goats', words: ['goat', 'goats'] },
    { id: 'barn', one: 'barn', many: 'barns', words: ['barn', 'barns'] },
    { id: 'tractor', one: 'tractor', many: 'tractors', words: ['tractor', 'tractors'] },
  ], ['pig', 'hen', 'cat', 'dog', 'mud', 'pen', 'hog', 'kid', 'egg', 'hay'], ['cow', 'pig', 'hen', 'sheep', 'horse', 'barn', 'tractor', 'egg', 'farmer']),

  bugs: T('bugs', 'Bugs', 'bugs', 'ladybug', 'in the garden', { one: 'little ladybug', icon: 'ladybug' }, [
    { id: 'ladybug', one: 'ladybug', many: 'ladybugs', words: ['ladybug', 'ladybugs', 'lady bug', 'lady bugs', 'bug', 'bugs'], small: true },
    { id: 'bee', one: 'bee', many: 'bees', words: ['bee', 'bees', 'bumblebee', 'bumblebees'], small: true },
    { id: 'butterfly', one: 'butterfly', many: 'butterflies', words: ['butterfly', 'butterflies'] },
    { id: 'ant', one: 'ant', many: 'ants', words: ['ant', 'ants'] },
    { id: 'caterpillar', one: 'caterpillar', many: 'caterpillars', words: ['caterpillar', 'caterpillars'] },
    { id: 'snail', one: 'snail', many: 'snails', words: ['snail', 'snails'] },
    { id: 'spider', one: 'spider', many: 'spiders', words: ['spider', 'spiders'] },
    { id: 'dragonfly', one: 'dragonfly', many: 'dragonflies', words: ['dragonfly', 'dragonflies'] },
    { id: 'leaf', one: 'leaf', many: 'leaves', words: ['leaf', 'leaves'], small: true },
  ], ['bug', 'web', 'hop', 'dig', 'sun', 'bed', 'ant', 'big', 'wet', 'leg'], ['bug', 'bee', 'ant', 'spider', 'web', 'leaf', 'flower', 'wings', 'legs']),

  castles: T('castles', 'Princesses and castles', 'castles', 'castle', 'at the castle', { one: 'little dragon', icon: 'dragon' }, [
    { id: 'castle', one: 'castle', many: 'castles', words: ['castle', 'castles'] },
    { id: 'crown', one: 'crown', many: 'crowns', words: ['crown', 'crowns', 'tiara', 'tiaras'], small: true },
    { id: 'princess', one: 'princess', many: 'princesses', words: ['princess', 'princesses'] },
    { id: 'dragon', one: 'dragon', many: 'dragons', words: ['dragon', 'dragons'] },
    { id: 'shield', one: 'shield', many: 'shields', words: ['shield', 'shields'], small: true },
    { id: 'wand', one: 'wand', many: 'wands', words: ['wand', 'wands', 'magic wand', 'magic wands'] },
    { id: 'carriage', one: 'carriage', many: 'carriages', words: ['carriage', 'carriages', 'coach'] },
    { id: 'frog', one: 'frog', many: 'frogs', words: ['frog', 'frogs'] },
    { id: 'ring', one: 'ring', many: 'rings', words: ['ring', 'rings'], small: true },
  ], ['gem', 'big', 'top', 'sat', 'ran', 'fun', 'red', 'hat', 'map', 'bed'], ['castle', 'crown', 'princess', 'prince', 'dragon', 'tower', 'gate', 'wand', 'ball']),

  trains: T('trains', 'Trains', 'trains', 'engine', 'on the train tracks', { one: 'little red engine', icon: 'engine' }, [
    { id: 'engine', one: 'engine', many: 'engines', words: ['engine', 'engines', 'train', 'trains', 'locomotive'] },
    { id: 'passenger-car', one: 'train car', many: 'train cars', words: ['train car', 'train cars', 'passenger car', 'passenger cars'] },
    { id: 'caboose', one: 'caboose', many: 'cabooses', words: ['caboose', 'cabooses'] },
    { id: 'boxcar', one: 'boxcar', many: 'boxcars', words: ['boxcar', 'boxcars', 'box car', 'box cars'] },
    { id: 'crossing', one: 'crossing sign', many: 'crossing signs', words: ['crossing sign', 'crossing signs', 'crossing', 'railroad crossing', 'sign', 'signs'] },
    { id: 'conductor-hat', one: 'conductor hat', many: 'conductor hats', words: ['conductor hat', 'conductor hats', 'conductor\'s hat'], small: true },
    { id: 'tunnel', one: 'tunnel', many: 'tunnels', words: ['tunnel', 'tunnels'] },
    { id: 'ticket', one: 'ticket', many: 'tickets', words: ['ticket', 'tickets'], small: true },
  ], ['hop', 'top', 'sit', 'ran', 'run', 'fun', 'big', 'red', 'hill', 'toot'], ['train', 'engine', 'track', 'tunnel', 'ticket', 'caboose', 'station', 'whistle', 'conductor']),

  sports: T('sports', 'Sports', 'sports', 'soccer-ball', 'at the ball field', { one: 'team', icon: 'soccer-ball' }, [
    { id: 'soccer-ball', one: 'soccer ball', many: 'soccer balls', words: ['soccer ball', 'soccer balls', 'soccer'], small: true },
    { id: 'basketball', one: 'basketball', many: 'basketballs', words: ['basketball', 'basketballs'], small: true },
    { id: 'football', one: 'football', many: 'footballs', words: ['football', 'footballs'], small: true },
    { id: 'bat-and-ball', one: 'bat and ball', many: 'bats and balls', words: ['bat and ball', 'bat', 'bats', 'baseball', 'baseballs'] },
    { id: 'tennis', one: 'tennis racket', many: 'tennis rackets', words: ['tennis racket', 'tennis rackets', 'racket', 'rackets', 'tennis'] },
    { id: 'trophy', one: 'trophy', many: 'trophies', words: ['trophy', 'trophies'] },
    { id: 'medal', one: 'medal', many: 'medals', words: ['medal', 'medals'], small: true },
    { id: 'goal', one: 'goal', many: 'goals', words: ['goal', 'goals'] },
    { id: 'sneaker', one: 'sneaker', many: 'sneakers', words: ['sneaker', 'sneakers', 'running shoes'], small: true },
  ], ['bat', 'hit', 'run', 'kit', 'net', 'win', 'cap', 'kick', 'fun', 'top'], ['ball', 'bat', 'goal', 'team', 'coach', 'trophy', 'medal', 'field', 'sneakers']),

  pets: T('pets', 'Pets', 'pets', 'puppy', 'at home', { one: 'little pup', icon: 'puppy' }, [
    { id: 'puppy', one: 'puppy', many: 'puppies', words: ['puppy', 'puppies', 'pup', 'pups', 'dog', 'dogs', 'doggy'] },
    { id: 'kitten', one: 'kitten', many: 'kittens', words: ['kitten', 'kittens', 'cat', 'cats', 'kitty'] },
    { id: 'goldfish', one: 'goldfish', many: 'goldfish', words: ['goldfish', 'fish'] },
    { id: 'bunny', one: 'bunny', many: 'bunnies', words: ['bunny', 'bunnies', 'rabbit', 'rabbits'] },
    { id: 'hamster', one: 'hamster', many: 'hamsters', words: ['hamster', 'hamsters'] },
    { id: 'parakeet', one: 'parakeet', many: 'parakeets', words: ['parakeet', 'parakeets', 'budgie', 'budgies'] },
    { id: 'turtle', one: 'turtle', many: 'turtles', words: ['turtle', 'turtles'] },
    { id: 'food-bowl', one: 'food bowl', many: 'food bowls', words: ['food bowl', 'food bowls', 'bowl', 'bowls'], small: true },
    { id: 'yarn', one: 'ball of yarn', many: 'balls of yarn', words: ['yarn', 'ball of yarn'], small: true },
  ], ['pet', 'cat', 'dog', 'pup', 'vet', 'fed', 'sit', 'nap', 'hug', 'tub'], ['puppy', 'kitten', 'fish', 'bunny', 'leash', 'bowl', 'bed', 'treat', 'vet']),

  jungle: T('jungle', 'Jungle animals', 'jungle animals', 'lion', 'in the jungle', { one: 'little monkey', icon: 'monkey' }, [
    { id: 'lion', one: 'lion', many: 'lions', words: ['lion', 'lions'] },
    { id: 'monkey', one: 'monkey', many: 'monkeys', words: ['monkey', 'monkeys'] },
    { id: 'elephant', one: 'elephant', many: 'elephants', words: ['elephant', 'elephants'] },
    { id: 'giraffe', one: 'giraffe', many: 'giraffes', words: ['giraffe', 'giraffes'] },
    { id: 'zebra', one: 'zebra', many: 'zebras', words: ['zebra', 'zebras'] },
    { id: 'snake', one: 'snake', many: 'snakes', words: ['snake', 'snakes'] },
    { id: 'parrot', one: 'parrot', many: 'parrots', words: ['parrot', 'parrots'] },
    { id: 'hippo', one: 'hippo', many: 'hippos', words: ['hippo', 'hippos', 'hippopotamus'] },
    { id: 'bananas', one: 'bunch of bananas', many: 'bunches of bananas', words: ['banana', 'bananas', 'bunch of bananas'], small: true },
  ], ['hop', 'nap', 'sun', 'mud', 'big', 'hug', 'yum', 'zip', 'run', 'tag'], ['lion', 'monkey', 'elephant', 'giraffe', 'zebra', 'snake', 'tree', 'vine', 'banana']),
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

// ---------- Which picture goes with some words ----------
// Used by the little book and the word problems page to pick a picture, by the AI validator to check the pictures
// the model chose, and by the tests. A picture is only ever shown next to words that name it.

/** Lowercase words with single spaces around them: "{{name}}'s T-rex!" -> " t rex ". Names are left out, so a child
 *  called Rex or Bee never turns into a picture. */
export function normWords(text: string): string {
  const t = text.toLowerCase().replace(/\{\{name\}\}/g, ' ').replace(/[’‘`]/g, "'").replace(/'s\b/g, '').replace(/'/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  return ` ${t} `;
}
/** Every way of naming an icon, normalized. */
export function iconNames(ic: ThemeIcon): string[] {
  return [...new Set([ic.one, ic.many, ...(ic.words ?? [])].map((w) => normWords(w).trim()).filter(Boolean))];
}
/** How the theme's buddy is named in a story ("little T-rex", "T-rex", "team"). */
function buddyNames(theme: ThemeId): string[] {
  const one = THEMES[theme].buddy.one;
  return [...new Set([one, one.replace(/^little /, ''), `${one}s`].map((w) => normWords(w).trim()).filter(Boolean))];
}
function firstAt(hay: string, names: string[]): { at: number; len: number } | null {
  let best: { at: number; len: number } | null = null;
  for (const n of names) {
    const at = hay.indexOf(` ${n} `);
    if (at >= 0 && (!best || at < best.at || (at === best.at && n.length > best.len))) best = { at, len: n.length };
  }
  return best;
}
/** True when the words name this icon (or, for the buddy's icon, name the buddy). */
export function mentionsIcon(theme: ThemeId, text: string, id: string): boolean {
  const T = THEMES[theme];
  const ic = T.icons.find((i) => i.id === id);
  if (!ic) return false;
  const hay = normWords(text);
  return Boolean(firstAt(hay, iconNames(ic)) || (id === T.buddy.icon && firstAt(hay, buddyNames(theme))));
}
/**
 * The picture for some words: the pictured thing named first (the longest name wins at the same spot, so
 * "fire truck" beats "truck" and "train car" beats "train"). If nothing pictured is named, the buddy's picture when
 * the words name the buddy. Otherwise null: the page shows a "Draw it!" box, never an unrelated picture.
 */
export function storyIcon(theme: ThemeId, text: string, opts: { buddy?: boolean } = {}): string | null {
  const T = THEMES[theme];
  const hay = normWords(text);
  let best: { id: string; at: number; len: number } | null = null;
  for (const ic of T.icons) {
    const hit = firstAt(hay, iconNames(ic));
    if (hit && (!best || hit.at < best.at || (hit.at === best.at && hit.len > best.len))) best = { id: ic.id, ...hit };
  }
  if (best) return best.id;
  return opts.buddy !== false && firstAt(hay, buddyNames(theme)) ? T.buddy.icon : null;
}
export const themeInfo = (id: ThemeId) => THEMES[id];
export const iconUrl = (theme: ThemeId, icon: string) => `/program/icons/${theme}/${icon}.svg`;
export const coverUrl = (theme: ThemeId) => iconUrl(theme, THEMES[theme].cover);
/** Icons that read well printed small (ten frames, rows of 10). Falls back to every icon. */
export const smallIcons = (theme: ThemeId) => {
  const s = THEMES[theme].icons.filter((i) => i.small);
  return s.length >= 3 ? s : THEMES[theme].icons;
};

// ---------- Icon path data ----------
// Each theme's paths live in one JSON file (0..1000 box). Load the themes you need before building pages;
// pages fall back to simple stars if a theme isn't loaded, so nothing breaks.

const loaded = new Map<ThemeId, Record<string, string>>();
const pending = new Map<ThemeId, Promise<void>>();

export type IconFetcher = (url: string) => Promise<string>;
const defaultFetch: IconFetcher = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); });

export function loadThemeIcons(themes: ThemeId[], fetcher: IconFetcher = defaultFetch): Promise<void> {
  return Promise.all([...new Set(themes)].map((t) => {
    if (loaded.has(t)) return Promise.resolve();
    if (!pending.has(t)) {
      pending.set(t, fetcher(`/program/icons/${t}.json`)
        .then((txt) => { loaded.set(t, (JSON.parse(txt) as { icons: Record<string, string> }).icons); })
        .catch(() => { pending.delete(t); }));
    }
    return pending.get(t)!;
  })).then(() => undefined);
}
export const iconsReady = (t: ThemeId) => loaded.has(t);
export const iconPath = (t: ThemeId, id: string): string | null => loaded.get(t)?.[id] ?? null;

/**
 * The picture for a word problem: what the child counts. That is the thing named right after one of the problem's
 * numbers ("4 steps", "2 T-rexes", "3 dinosaur eggs"). When the counted thing has no picture ("5 leaves" in the
 * dinosaur theme) the answer is null and the page draws plain circles, even if a pictured thing is named elsewhere
 * in the text. Undefined when no number is followed by a noun ("1 more"): then the caller decides.
 */
export function countedIcon(theme: ThemeId, text: string, nums: number[]): string | null | undefined {
  // Look within each clause, so "3 or 5? Count the cows." doesn't read "count" as the thing counted.
  const clauses = text.split(/[.?!,;:]+/).map(normWords);
  const T = THEMES[theme];
  const SKIP = new Set(['more', 'of', 'the', 'big', 'little', 'small', 'red', 'green', 'blue', 'yellow', 'pink', 'brown', 'tall', 'baby', 'shiny', 'sleepy', 'happy', 'new', 'old', 'tiny', 'fat', 'long']);
  let sawNoun = false;
  for (const n of nums) {
    for (const m of clauses.flatMap((hay) => [...hay.matchAll(new RegExp(` ${n} ((?:[a-z]+ ){1,4})`, 'g'))])) {
      const after = ` ${m[1]}`;
      let best: { id: string; len: number } | null = null;
      for (const ic of T.icons) for (const name of iconNames(ic)) {
        // The name may follow a word or two of description: "3 big dinosaur eggs", "2 more bones".
        const words = after.trim().split(' ');
        for (let k = 0; k < words.length && (k === 0 || SKIP.has(words[k - 1])); k++) {
          if (` ${words.slice(k).join(' ')} `.startsWith(` ${name} `) && (!best || name.length > best.len)) best = { id: ic.id, len: name.length };
        }
      }
      if (best) return best.id;
      const first = after.trim().split(' ').find((w) => !SKIP.has(w));
      if (first && !/^(and|then|plus|minus|or|to|in|on|at|is|are|how|now|left|in all|altogether)$/.test(first)) sawNoun = true;
    }
  }
  return sawNoun ? null : undefined;
}
