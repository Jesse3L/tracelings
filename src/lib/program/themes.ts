// The 12 interest themes for the personalized program: labels, kid-friendly word lists and the line icons.
// Icons are original black-and-white line art traced to vector paths (public/program/icons/<theme>.json),
// so they print crisply in the PDF and the on-screen preview. Picture-grid images use the .svg files.
import type { ThemeId } from './types';

export interface ThemeIcon {
  id: string;        // file name under public/program/icons/<theme>/
  one: string;       // "T-rex"
  many: string;      // "T-rexes"
  small?: boolean;   // simple enough to read clearly when printed small (ten frames, groups of 10 or more)
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
    { id: 't-rex', one: 'T-rex', many: 'T-rexes' },
    { id: 'long-neck', one: 'long-neck dinosaur', many: 'long-neck dinosaurs' },
    { id: 'triceratops', one: 'triceratops', many: 'triceratops' },
    { id: 'stegosaurus', one: 'stegosaurus', many: 'stegosauruses' },
    { id: 'egg', one: 'dinosaur egg', many: 'dinosaur eggs', small: true },
    { id: 'footprint', one: 'footprint', many: 'footprints', small: true },
    { id: 'bone', one: 'bone', many: 'bones', small: true },
    { id: 'volcano', one: 'volcano', many: 'volcanoes' },
    { id: 'palm-tree', one: 'palm tree', many: 'palm trees' },
  ], ['rex', 'egg', 'big', 'dig', 'mud', 'den', 'run', 'hot', 'sun', 'red'], ['dinosaur', 'T-rex', 'egg', 'bone', 'fossil', 'footprint', 'volcano', 'tail', 'claws']),

  trucks: T('trucks', 'Trucks and cars', 'trucks', 'dump-truck', 'on the big road', { one: 'little red truck', icon: 'dump-truck' }, [
    { id: 'dump-truck', one: 'dump truck', many: 'dump trucks' },
    { id: 'fire-truck', one: 'fire truck', many: 'fire trucks' },
    { id: 'car', one: 'car', many: 'cars', small: true },
    { id: 'bus', one: 'bus', many: 'buses' },
    { id: 'mixer', one: 'cement mixer', many: 'cement mixers' },
    { id: 'digger', one: 'digger', many: 'diggers' },
    { id: 'tow-truck', one: 'tow truck', many: 'tow trucks' },
    { id: 'cone', one: 'cone', many: 'cones', small: true },
    { id: 'traffic-light', one: 'traffic light', many: 'traffic lights', small: true },
  ], ['bus', 'van', 'cab', 'dig', 'mud', 'big', 'red', 'rig', 'go', 'stop'], ['truck', 'car', 'bus', 'digger', 'wheel', 'road', 'cone', 'driver', 'garage']),

  unicorns: T('unicorns', 'Unicorns', 'unicorns', 'unicorn', 'over the rainbow', { one: 'little unicorn', icon: 'unicorn' }, [
    { id: 'unicorn', one: 'unicorn', many: 'unicorns' },
    { id: 'unicorn-head', one: 'unicorn', many: 'unicorns' },
    { id: 'rainbow', one: 'rainbow', many: 'rainbows' },
    { id: 'star', one: 'star', many: 'stars', small: true },
    { id: 'heart', one: 'heart', many: 'hearts', small: true },
    { id: 'cloud', one: 'cloud', many: 'clouds', small: true },
    { id: 'gem', one: 'gem', many: 'gems', small: true },
    { id: 'wand', one: 'magic wand', many: 'magic wands' },
    { id: 'flower', one: 'flower', many: 'flowers', small: true },
  ], ['sun', 'fun', 'hop', 'run', 'gem', 'red', 'pink', 'mud', 'hug', 'nap'], ['unicorn', 'rainbow', 'horn', 'mane', 'star', 'cloud', 'gem', 'wand', 'sparkle']),

  ocean: T('ocean', 'Ocean animals', 'ocean animals', 'whale', 'under the sea', { one: 'little crab', icon: 'crab' }, [
    { id: 'fish', one: 'fish', many: 'fish', small: true },
    { id: 'whale', one: 'whale', many: 'whales' },
    { id: 'octopus', one: 'octopus', many: 'octopuses' },
    { id: 'crab', one: 'crab', many: 'crabs', small: true },
    { id: 'turtle', one: 'sea turtle', many: 'sea turtles' },
    { id: 'starfish', one: 'starfish', many: 'starfish', small: true },
    { id: 'shell', one: 'shell', many: 'shells', small: true },
    { id: 'jellyfish', one: 'jellyfish', many: 'jellyfish' },
    { id: 'seahorse', one: 'seahorse', many: 'seahorses' },
  ], ['fin', 'net', 'wet', 'sun', 'dip', 'sand', 'crab', 'swim', 'big', 'bob'], ['fish', 'whale', 'crab', 'octopus', 'shell', 'wave', 'sand', 'seaweed', 'bubbles']),

  space: T('space', 'Space', 'space', 'rocket', 'in outer space', { one: 'little alien', icon: 'alien' }, [
    { id: 'rocket', one: 'rocket', many: 'rockets' },
    { id: 'planet', one: 'planet', many: 'planets', small: true },
    { id: 'moon', one: 'moon', many: 'moons', small: true },
    { id: 'star', one: 'star', many: 'stars', small: true },
    { id: 'astronaut', one: 'astronaut', many: 'astronauts' },
    { id: 'alien', one: 'alien', many: 'aliens' },
    { id: 'satellite', one: 'satellite', many: 'satellites' },
    { id: 'sun', one: 'sun', many: 'suns', small: true },
    { id: 'telescope', one: 'telescope', many: 'telescopes' },
  ], ['sun', 'hot', 'big', 'top', 'zip', 'jet', 'fun', 'up', 'red', 'map'], ['rocket', 'moon', 'star', 'planet', 'astronaut', 'helmet', 'sun', 'comet', 'telescope']),

  farm: T('farm', 'Farm animals', 'farm animals', 'cow', 'on the farm', { one: 'little pig', icon: 'pig' }, [
    { id: 'cow', one: 'cow', many: 'cows' },
    { id: 'pig', one: 'pig', many: 'pigs' },
    { id: 'hen', one: 'hen', many: 'hens' },
    { id: 'sheep', one: 'sheep', many: 'sheep' },
    { id: 'horse', one: 'horse', many: 'horses' },
    { id: 'duck', one: 'duck', many: 'ducks', small: true },
    { id: 'goat', one: 'goat', many: 'goats' },
    { id: 'barn', one: 'barn', many: 'barns' },
    { id: 'tractor', one: 'tractor', many: 'tractors' },
  ], ['pig', 'hen', 'cat', 'dog', 'mud', 'pen', 'hog', 'kid', 'egg', 'hay'], ['cow', 'pig', 'hen', 'sheep', 'horse', 'barn', 'tractor', 'egg', 'farmer']),

  bugs: T('bugs', 'Bugs', 'bugs', 'ladybug', 'in the garden', { one: 'little ladybug', icon: 'ladybug' }, [
    { id: 'ladybug', one: 'ladybug', many: 'ladybugs', small: true },
    { id: 'bee', one: 'bee', many: 'bees', small: true },
    { id: 'butterfly', one: 'butterfly', many: 'butterflies' },
    { id: 'ant', one: 'ant', many: 'ants' },
    { id: 'caterpillar', one: 'caterpillar', many: 'caterpillars' },
    { id: 'snail', one: 'snail', many: 'snails' },
    { id: 'spider', one: 'spider', many: 'spiders' },
    { id: 'dragonfly', one: 'dragonfly', many: 'dragonflies' },
    { id: 'leaf', one: 'leaf', many: 'leaves', small: true },
  ], ['bug', 'web', 'hop', 'dig', 'sun', 'bed', 'ant', 'big', 'wet', 'leg'], ['bug', 'bee', 'ant', 'spider', 'web', 'leaf', 'flower', 'wings', 'legs']),

  castles: T('castles', 'Princesses and castles', 'castles', 'castle', 'at the castle', { one: 'little dragon', icon: 'dragon' }, [
    { id: 'castle', one: 'castle', many: 'castles' },
    { id: 'crown', one: 'crown', many: 'crowns', small: true },
    { id: 'princess', one: 'princess', many: 'princesses' },
    { id: 'dragon', one: 'dragon', many: 'dragons' },
    { id: 'shield', one: 'shield', many: 'shields', small: true },
    { id: 'wand', one: 'wand', many: 'wands' },
    { id: 'carriage', one: 'carriage', many: 'carriages' },
    { id: 'frog', one: 'frog', many: 'frogs' },
    { id: 'ring', one: 'ring', many: 'rings', small: true },
  ], ['gem', 'big', 'top', 'sat', 'ran', 'fun', 'red', 'hat', 'map', 'bed'], ['castle', 'crown', 'princess', 'prince', 'dragon', 'tower', 'gate', 'wand', 'ball']),

  trains: T('trains', 'Trains', 'trains', 'engine', 'on the train tracks', { one: 'little red engine', icon: 'engine' }, [
    { id: 'engine', one: 'engine', many: 'engines' },
    { id: 'passenger-car', one: 'train car', many: 'train cars' },
    { id: 'caboose', one: 'caboose', many: 'cabooses' },
    { id: 'boxcar', one: 'boxcar', many: 'boxcars' },
    { id: 'crossing', one: 'crossing sign', many: 'crossing signs' },
    { id: 'conductor-hat', one: 'conductor hat', many: 'conductor hats', small: true },
    { id: 'tunnel', one: 'tunnel', many: 'tunnels' },
    { id: 'ticket', one: 'ticket', many: 'tickets', small: true },
  ], ['hop', 'top', 'sit', 'ran', 'run', 'fun', 'big', 'red', 'hill', 'toot'], ['train', 'engine', 'track', 'tunnel', 'ticket', 'caboose', 'station', 'whistle', 'conductor']),

  sports: T('sports', 'Sports', 'sports', 'soccer-ball', 'at the ball field', { one: 'team', icon: 'soccer-ball' }, [
    { id: 'soccer-ball', one: 'soccer ball', many: 'soccer balls', small: true },
    { id: 'basketball', one: 'basketball', many: 'basketballs', small: true },
    { id: 'football', one: 'football', many: 'footballs', small: true },
    { id: 'bat-and-ball', one: 'bat and ball', many: 'bats and balls' },
    { id: 'tennis', one: 'tennis racket', many: 'tennis rackets' },
    { id: 'trophy', one: 'trophy', many: 'trophies' },
    { id: 'medal', one: 'medal', many: 'medals', small: true },
    { id: 'goal', one: 'goal', many: 'goals' },
    { id: 'sneaker', one: 'sneaker', many: 'sneakers', small: true },
  ], ['bat', 'hit', 'run', 'kit', 'net', 'win', 'cap', 'kick', 'fun', 'top'], ['ball', 'bat', 'goal', 'team', 'coach', 'trophy', 'medal', 'field', 'sneakers']),

  pets: T('pets', 'Pets', 'pets', 'puppy', 'at home', { one: 'little pup', icon: 'puppy' }, [
    { id: 'puppy', one: 'puppy', many: 'puppies' },
    { id: 'kitten', one: 'kitten', many: 'kittens' },
    { id: 'goldfish', one: 'goldfish', many: 'goldfish' },
    { id: 'bunny', one: 'bunny', many: 'bunnies' },
    { id: 'hamster', one: 'hamster', many: 'hamsters' },
    { id: 'parakeet', one: 'parakeet', many: 'parakeets' },
    { id: 'turtle', one: 'turtle', many: 'turtles' },
    { id: 'food-bowl', one: 'food bowl', many: 'food bowls', small: true },
    { id: 'yarn', one: 'ball of yarn', many: 'balls of yarn', small: true },
  ], ['pet', 'cat', 'dog', 'pup', 'vet', 'fed', 'sit', 'nap', 'hug', 'tub'], ['puppy', 'kitten', 'fish', 'bunny', 'leash', 'bowl', 'bed', 'treat', 'vet']),

  jungle: T('jungle', 'Jungle animals', 'jungle animals', 'lion', 'in the jungle', { one: 'little monkey', icon: 'monkey' }, [
    { id: 'lion', one: 'lion', many: 'lions' },
    { id: 'monkey', one: 'monkey', many: 'monkeys' },
    { id: 'elephant', one: 'elephant', many: 'elephants' },
    { id: 'giraffe', one: 'giraffe', many: 'giraffes' },
    { id: 'zebra', one: 'zebra', many: 'zebras' },
    { id: 'snake', one: 'snake', many: 'snakes' },
    { id: 'parrot', one: 'parrot', many: 'parrots' },
    { id: 'hippo', one: 'hippo', many: 'hippos' },
    { id: 'bananas', one: 'bunch of bananas', many: 'bunches of bananas', small: true },
  ], ['hop', 'nap', 'sun', 'mud', 'big', 'hug', 'yum', 'zip', 'run', 'tag'], ['lion', 'monkey', 'elephant', 'giraffe', 'zebra', 'snake', 'tree', 'vine', 'banana']),
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
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
