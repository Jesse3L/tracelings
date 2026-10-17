// The story scene library for the big picture book (see docs/program-plan.md).
//
// Why this exists: printed AI stories showed one generic icon per page, so the picture rarely matched the words
// ("The T-rex has a big egg in its nest" showed only a T-rex) and pages jumped between characters. Now each theme has
// a recurring cast and 30 to 36 pre-drawn scenes. The story writer builds a week's story by picking a sequence of
// scenes (usually one of the ready `paths`) and writing words for each page that are true of that picture.
//
// Contract for the two agents that build on this file:
// - Art agent: draw every scene from its `drawPrompt` and save it at public/program/scenes/<theme>/<id>.png
//   (see sceneSrc). Draw the cast exactly as described, every time, so they look the same on every page.
// - Story writer: one page per scene. Every sentence must be true of `shows`; name only what is visible
//   (`cast` and `props`), and prefer `words`. The child is never drawn. They are in the story as {{name}}, a friend
//   who goes along and sees everything from where the viewer stands ("Stomp waves at {{name}}" is fine; "{{name}}
//   climbs the tree" is not, because nobody is climbing in the picture).
// - Book sizes: Pre-K is 2 sheets (6 to 8 story pages), Kindergarten is 3 sheets (10 to 12 story pages).
//   Every path has a `level` that matches its length.
//
// Every string follows docs/content-guide.md (no em dashes, no banned words). Run: npx tsx scripts/check-scenes.mts
import type { Level } from '../homeschool';
import type { ThemeId } from './types';

export type Beat = 'opening' | 'explore' | 'find' | 'problem' | 'try' | 'help' | 'solve' | 'celebrate' | 'rest' | 'ending';
export const BEATS: Beat[] = ['opening', 'explore', 'find', 'problem', 'try', 'help', 'solve', 'celebrate', 'rest', 'ending'];

export interface CastMember {
  name: string;            // short, easy to sound out, and not a common child's first name
  kind: string;            // what it is, in a word or two: "T-rex"
  pronoun: 'he' | 'she' | 'it';
  /** Name-free look, repeated word for word in every drawPrompt so the character never changes. */
  describe: string;
  /** Ways a page may name this character. */
  words: string[];
  /** The matching theme icon from themes.ts, when there is one (covers, back page). */
  icon?: string;
}

export interface Scene {
  id: string;              // file name: public/program/scenes/<theme>/<id>.png
  beat: Beat;
  /** Exactly what is in the picture. A page's words must be true of this. */
  shows: string;
  cast: string[];          // cast names visible in the picture
  props: string[];         // things visible in the picture
  /** Nouns, verbs and describing words a page about this picture may use (short decodable words included). */
  words: string[];
  /** The full prompt for the illustrator: SCENE_STYLE, the scene, and the cast descriptions word for word. */
  drawPrompt: string;
}

export interface StoryPath {
  id: string;
  title: string;           // a working title; the writer may put {{name}} in the book title
  plot: string;            // one line: the one problem and how it gets solved
  level: Level;            // pre-k: 6 to 8 scenes; kindergarten: 10 to 12 scenes
  scenes: string[];        // scene ids in reading order
  /** What the problem is about. The problem page and the solve page both name one of these, so the thing that
   *  went wrong is the thing that gets fixed (a lost shell is found, not a ball). */
  about: string[];
}

/** theme/pathId -> what the problem is about (see StoryPath.about). */
const ABOUT: Record<string, string[]> = {
  'dinosaurs/lost-egg': ['egg'], 'dinosaurs/egg-short': ['egg'], 'dinosaurs/high-leaves': ['leaves', 'leaf', 'branch'], 'dinosaurs/mud': ['mud', 'muddy', 'stuck', 'free'], 'dinosaurs/big-bone': ['bone'],
  'trucks/mud': ['mud', 'muddy', 'stuck', 'free'], 'trucks/ball': ['ball'], 'trucks/rock': ['rock'], 'trucks/flat': ['tire'],
  'unicorns/star': ['star'], 'unicorns/stream': ['stream', 'bridge', 'rainbow'], 'unicorns/kite': ['kite'], 'unicorns/flowers': ['flowers', 'flower'],
  'ocean/shell': ['shell'], 'ocean/chest': ['chest', 'lid'], 'ocean/ball': ['ball'], 'ocean/gup': ['Gup'],
  'space/ball': ['ball'], 'space/crater': ['crater', 'hole'], 'space/planet': ['planet'], 'space/seed': ['seed', 'sprout', 'pot'],
  'farm/egg': ['egg'], 'farm/gate': ['gate'], 'farm/apples': ['apple', 'apples'], 'farm/bell': ['bell'],
  'bugs/butterfly': ['leaf'], 'bugs/leaf-boat': ['leaf', 'boat'], 'bugs/crumb': ['crumb', 'cake'], 'bugs/lost-buzz': ['hive', 'home'],
  'castles/crown': ['crown'], 'castles/ball': ['ball'], 'castles/gate': ['gate'], 'castles/party': ['door', 'party', 'fit'],
  'trains/hill': ['hill'], 'trains/branch': ['branch', 'track'], 'trains/caboose': ['caboose'], 'trains/boxes': ['boxes', 'box', 'tunnel'],
  'sports/tree': ['ball'], 'sports/tee': ['ball'], 'sports/sneaker': ['sneaker'], 'sports/hoop': ['hoop', 'ball'],
  'pets/ball': ['ball'], 'pets/shelf': ['shelf', 'down'], 'pets/mud': ['mud', 'muddy', 'clean'], 'pets/nibs': ['Nibs'],
  'jungle/bananas': ['bananas'], 'jungle/ball': ['ball'], 'jungle/hot': ['hot', 'cool'], 'jungle/hide': ['Zip'],
};

export interface ThemeScenes {
  theme: ThemeId;
  setting: string;         // the shared world, for the illustrator and the writer
  cast: CastMember[];
  scenes: Scene[];
  paths: StoryPath[];
}

/** Shared style for every scene picture. */
export const SCENE_STYLE = 'Simple clean black and white coloring book line art for young children, bold even outlines, no shading, no text, white background, one scene filling a 4:3 landscape frame. Friendly and calm: soft closed-mouth smiles, no teeth showing, nothing scary. Characters face the viewer or each other. Draw only the characters and things in the scene; no other people and no child. Vehicles and trains have no faces. Character names are for reference only and never appear in the picture.';

// ---------- builders ----------

type Draft = Omit<Scene, 'drawPrompt'>;
const s = (id: string, beat: Beat, shows: string, cast: string[], props: string[], words: string[]): Draft =>
  ({ id, beat, shows, cast, props, words });
const path = (id: string, title: string, level: Level, plot: string, scenes: string[]): StoryPath => ({ id, title, plot, level, scenes, about: [] });

function build(theme: ThemeId, setting: string, cast: CastMember[], drafts: Draft[], paths: StoryPath[]): ThemeScenes {
  const byName = new Map(cast.map((c) => [c.name, c]));
  const scenes = drafts.map((d): Scene => {
    const who = d.cast.map((n) => {
      const c = byName.get(n);
      return c ? `${n} is ${c.describe}.` : `${n}.`;
    }).join(' ');
    return { ...d, drawPrompt: `${SCENE_STYLE} Scene: ${d.shows}${who ? ` Characters: ${who}` : ''}` };
  });
  return { theme, setting, cast, scenes, paths: paths.map((p) => ({ ...p, about: ABOUT[`${theme}/${p.id}`] ?? [] })) };
}

// ---------- the 12 themes ----------

const dinosaurs = build('dinosaurs',
  'A sunny valley of ferns, palm trees, big round rocks, a calm lake and a rock den.',
  [
    { name: 'Stomp', kind: 'T-rex', pronoun: 'he', icon: 't-rex', describe: 'a small friendly T-rex with big round eyes, tiny arms, a short stripe pattern on his back and a thick tail', words: ['Stomp', 'T-rex', 'little T-rex', 'dinosaur', 'dino', 'he', 'his'] },
    { name: 'Dot', kind: 'long-neck dinosaur', pronoun: 'she', icon: 'long-neck', describe: 'a tall gentle long-neck dinosaur with round spots on her body, a long neck, a small head and a long tail', words: ['Dot', 'long-neck', 'long-neck dinosaur', 'dinosaur', 'she', 'her'] },
    { name: 'Tops', kind: 'triceratops', pronoun: 'he', icon: 'triceratops', describe: 'a small round triceratops with three short blunt horns, a wide frill with a scalloped edge and stubby legs', words: ['Tops', 'triceratops', 'dinosaur', 'he', 'his'] },
  ],
  [
    s('open-morning', 'opening', "Stomp stands beside a palm tree in the morning sun and waves one tiny arm toward the viewer.", ['Stomp'], ['palm tree', 'sun', 'ferns'], ['sun', 'hot', 'tree', 'wave', 'hi', 'morning', 'up']),
    s('open-friends', 'opening', "Stomp, Dot and Tops stand together on a grassy hill and smile toward the viewer, with a round sun in the sky.", ['Stomp', 'Dot', 'Tops'], ['hill', 'grass', 'sun'], ['friends', 'hill', 'sun', 'big', 'tall', 'smile', 'three']),
    s('open-den', 'opening', "Stomp peeks out of the doorway of a cozy rock den with ferns growing by the door.", ['Stomp'], ['rock den', 'ferns', 'rocks'], ['den', 'rock', 'peek', 'out', 'home', 'ferns']),
    s('exp-walk', 'explore', "Stomp and Tops walk side by side on a dirt path past big ferns and round rocks, with a line of footprints behind them.", ['Stomp', 'Tops'], ['path', 'ferns', 'rocks', 'footprints'], ['walk', 'path', 'step', 'footprints', 'rocks', 'ferns', 'go']),
    s('exp-lake', 'explore', "Dot bends her long neck down to drink from a calm lake while Stomp and Tops splash their feet at the edge.", ['Dot', 'Stomp', 'Tops'], ['lake', 'water', 'reeds'], ['lake', 'wet', 'drink', 'splash', 'sip', 'water', 'neck']),
    s('exp-ferns', 'explore', "Tops pushes through a patch of tall ferns, with only his smiling face and three horns peeking out.", ['Tops'], ['ferns'], ['ferns', 'peek', 'push', 'horns', 'tall', 'hide']),
    s('find-egg', 'find', "Stomp stands beside a nest of sticks with one big speckled egg in it, looking at it with wide happy eyes.", ['Stomp'], ['nest', 'sticks', 'egg'], ['egg', 'nest', 'big', 'spots', 'sticks', 'look', 'one']),
    s('find-tree', 'find', "Tops looks up at a very tall tree with a bunch of fresh green leaves at the very top.", ['Tops'], ['tall tree', 'leaves'], ['tree', 'tall', 'leaves', 'top', 'up', 'look', 'green']),
    s('find-puddle', 'find', "A big round mud puddle fills the path, and Tops steps toward it with one foot lifted.", ['Tops'], ['mud puddle', 'path'], ['mud', 'puddle', 'step', 'wet', 'big', 'path']),
    s('find-bone', 'find', "Stomp kicks sand with his feet and the end of a big bone sticks up out of the ground.", ['Stomp'], ['sand', 'bone'], ['dig', 'sand', 'bone', 'kick', 'big', 'find']),
    s('prob-egg-rolls', 'problem', "The speckled egg rolls down a grassy hill away from the empty nest while Stomp watches with a round surprised mouth.", ['Stomp'], ['egg', 'nest', 'hill'], ['egg', 'roll', 'down', 'hill', 'nest', 'oh no', 'away']),
    s('prob-too-high', 'problem', "Tops stands up on his back legs under the tall tree, but the green leaves are far above his head.", ['Tops'], ['tall tree', 'leaves'], ['high', 'up', 'reach', 'leaves', 'tall', 'top', 'can not']),
    s('prob-stuck', 'problem', "Tops stands in thick sticky mud up to his knees and looks down at his feet.", ['Tops'], ['mud puddle'], ['stuck', 'mud', 'legs', 'feet', 'sticky', 'wet']),
    s('prob-too-big', 'problem', "Stomp hugs one end of a bone that is longer than he is, and the bone does not move.", ['Stomp'], ['bone'], ['big', 'bone', 'lift', 'heavy', 'pull', 'can not']),
    s('try-tracks', 'try', "Stomp and Tops follow a thin wiggly track in the sand that the rolling egg left behind.", ['Stomp', 'Tops'], ['track', 'sand'], ['track', 'follow', 'sand', 'look', 'go', 'egg']),
    s('try-jump', 'try', "Tops jumps with all four feet off the ground under the tall tree, still far below the leaves.", ['Tops'], ['tall tree', 'leaves'], ['jump', 'hop', 'up', 'high', 'try', 'leaves']),
    s('try-pull', 'try', "Stomp holds Tops' front foot in his tiny arms and leans back to pull him out of the mud.", ['Stomp', 'Tops'], ['mud puddle'], ['pull', 'tug', 'mud', 'stuck', 'try', 'help']),
    s('try-push', 'try', "Stomp pushes the big bone with his head and it slides just a little in the sand.", ['Stomp'], ['bone', 'sand'], ['push', 'bone', 'big', 'sand', 'try', 'a bit']),
    s('help-dot-egg', 'help', "Dot bends her long neck down between two big rocks at the bottom of the hill and nudges the speckled egg out with her nose.", ['Dot'], ['egg', 'rocks', 'hill'], ['neck', 'long', 'reach', 'egg', 'rocks', 'help', 'nose']),
    s('help-dot-branch', 'help', "Dot holds a leafy branch from the top of the tall tree in her mouth and bends it down low for Tops.", ['Dot', 'Tops'], ['tall tree', 'branch', 'leaves'], ['branch', 'down', 'low', 'leaves', 'tall', 'help', 'neck']),
    s('help-dot-mud', 'help', "Dot gently pushes Tops from behind with her head while Stomp pulls his front foot.", ['Dot', 'Tops', 'Stomp'], ['mud puddle'], ['push', 'pull', 'help', 'mud', 'together', 'tug']),
    s('help-carry', 'help', "Dot carries the big bone across her back while Stomp and Tops walk beside her to keep it steady.", ['Dot', 'Stomp', 'Tops'], ['bone', 'path'], ['carry', 'bone', 'back', 'help', 'walk', 'together']),
    s('solve-egg-home', 'solve', "Stomp sets the speckled egg back in the nest of sticks, and Dot smiles down at it.", ['Stomp', 'Dot'], ['egg', 'nest', 'sticks'], ['egg', 'nest', 'back', 'set', 'safe', 'home']),
    s('solve-leaves', 'solve', "Tops munches green leaves from the low branch Dot is holding down for him.", ['Tops', 'Dot'], ['branch', 'leaves'], ['eat', 'munch', 'leaves', 'yum', 'green', 'branch']),
    s('solve-pop', 'solve', "Tops steps out of the mud puddle onto the grass with muddy feet, and Stomp and Dot smile at him.", ['Tops', 'Stomp', 'Dot'], ['mud puddle', 'grass'], ['out', 'pop', 'mud', 'feet', 'grass', 'free']),
    s('solve-bone-den', 'solve', "The big bone lies in front of the rock den, and Stomp, Dot and Tops stand beside it.", ['Stomp', 'Dot', 'Tops'], ['bone', 'rock den'], ['bone', 'den', 'home', 'big', 'set', 'did it']),
    s('cel-hatch', 'celebrate', "The speckled egg in the nest cracks open and a tiny baby triceratops with little nub horns peeks out, while Stomp claps his tiny arms.", ['Stomp'], ['egg', 'nest', 'baby triceratops', 'shell'], ['egg', 'crack', 'hatch', 'baby', 'peek', 'tap', 'yes']),
    s('cel-baby-hi', 'celebrate', "The tiny baby triceratops sits in the cracked shell and lifts one foot as if to say hi, with Stomp and Dot leaning in close.", ['Stomp', 'Dot'], ['baby triceratops', 'shell', 'nest'], ['baby', 'hi', 'little', 'shell', 'sit', 'hug']),
    s('cel-dance', 'celebrate', "Stomp, Dot and Tops stomp and dance in a circle on the grass, with footprints all around them.", ['Stomp', 'Dot', 'Tops'], ['grass', 'footprints'], ['dance', 'stomp', 'hop', 'fun', 'yay', 'footprints']),
    s('cel-splash', 'celebrate', "Stomp, Dot and Tops splash and play in the shallow edge of the lake to wash off the mud.", ['Stomp', 'Dot', 'Tops'], ['lake', 'water', 'splashes'], ['splash', 'wet', 'wash', 'lake', 'fun', 'mud']),
    s('rest-nap', 'rest', "Stomp curls up asleep in a soft nest of leaves under a palm tree, with his tail wrapped around him.", ['Stomp'], ['leaves', 'palm tree'], ['nap', 'sleep', 'leaves', 'bed', 'tired', 'rest']),
    s('rest-stars', 'rest', "Stomp, Dot and Tops lie on a hill at night looking up at a moon and lots of stars.", ['Stomp', 'Dot', 'Tops'], ['hill', 'moon', 'stars'], ['night', 'moon', 'stars', 'rest', 'look', 'sleepy']),
    s('rest-baby-nap', 'rest', "The tiny baby triceratops sleeps in the nest beside bits of eggshell, and Stomp sits next to it with sleepy eyes.", ['Stomp'], ['baby triceratops', 'nest', 'eggshell'], ['nap', 'baby', 'nest', 'sleep', 'shh', 'rest']),
    s('end-wave', 'ending', "Stomp, Dot and Tops stand in a row and wave goodbye toward the viewer.", ['Stomp', 'Dot', 'Tops'], ['grass', 'sun'], ['bye', 'wave', 'friends', 'see you', 'fun']),
    s('end-home', 'ending', "Stomp walks back toward the rock den and looks over his shoulder toward the viewer.", ['Stomp'], ['rock den', 'path'], ['home', 'den', 'walk', 'back', 'bye']),
    s('end-hug', 'ending', "Stomp and Tops hug, and Dot bends her long neck down over them both.", ['Stomp', 'Tops', 'Dot'], ['grass'], ['hug', 'friends', 'neck', 'love', 'happy']),
  ],
  [
    path('lost-egg', 'The Lost Egg', 'kindergarten', 'An egg rolls away from its nest; Dot reaches it with her long neck, and it hatches back at home.',
      ['open-friends', 'exp-walk', 'find-egg', 'prob-egg-rolls', 'try-tracks', 'help-dot-egg', 'solve-egg-home', 'cel-hatch', 'cel-baby-hi', 'rest-baby-nap', 'end-wave']),
    path('egg-short', 'The Egg on the Hill', 'pre-k', 'The egg rolls down a hill, Dot finds it between the rocks, and it hatches.',
      ['open-friends', 'find-egg', 'prob-egg-rolls', 'help-dot-egg', 'solve-egg-home', 'cel-hatch', 'rest-baby-nap']),
    path('high-leaves', 'Leaves Up High', 'pre-k', 'Tops cannot reach the leaves at the top of a tree until Dot bends a branch down.',
      ['open-friends', 'find-tree', 'prob-too-high', 'try-jump', 'help-dot-branch', 'solve-leaves', 'cel-dance', 'end-hug']),
    path('mud', 'Stuck in the Mud', 'kindergarten', 'Tops gets stuck in a mud puddle and his friends pull and push him out.',
      ['open-den', 'exp-walk', 'find-puddle', 'prob-stuck', 'try-pull', 'help-dot-mud', 'solve-pop', 'cel-splash', 'rest-stars', 'end-home']),
    path('big-bone', 'The Big Bone', 'pre-k', 'Stomp digs up a bone too big to move, and all three carry it home together.',
      ['open-morning', 'exp-ferns', 'find-bone', 'prob-too-big', 'try-push', 'help-carry', 'solve-bone-den', 'rest-nap']),
  ]);

const trucks = build('trucks',
  'A small town road with hills, a bridge over a stream, a dig site with dirt piles and cones, and a garage.',
  [
    { name: 'Bump', kind: 'dump truck', pronoun: 'it', icon: 'dump-truck', describe: 'a small chunky dump truck with a big tipping bed, a short square cab with plain windows, round chunky wheels and no face', words: ['Bump', 'truck', 'dump truck', 'little truck', 'it', 'its'] },
    { name: 'Scoop', kind: 'digger', pronoun: 'it', icon: 'digger', describe: 'a digger on crawler tracks with a long bending arm, a big toothless scoop bucket, a small cab with plain windows and no face', words: ['Scoop', 'digger', 'it', 'its'] },
    { name: 'Hook', kind: 'tow truck', pronoun: 'it', icon: 'tow-truck', describe: 'a small tow truck with a rounded cab with plain windows, a tow arm with a hook and a cable at the back, and no face', words: ['Hook', 'tow truck', 'truck', 'it', 'its'] },
  ],
  [
    s('open-garage', 'opening', "Bump rolls out through the open door of a small garage onto a sunny road.", ['Bump'], ['garage', 'road', 'sun'], ['go', 'road', 'sun', 'out', 'garage', 'beep']),
    s('open-friends', 'opening', "Bump, Scoop and Hook are parked side by side in a row in the morning sun, facing the viewer.", ['Bump', 'Scoop', 'Hook'], ['sun', 'road'], ['friends', 'trucks', 'sun', 'row', 'three', 'big']),
    s('open-road', 'opening', "Bump drives along a road past an orange cone and a traffic light.", ['Bump'], ['road', 'cone', 'traffic light'], ['road', 'go', 'cone', 'light', 'drive', 'stop']),
    s('exp-hill', 'explore', "Bump drives up a curvy hill road with round trees on both sides.", ['Bump'], ['hill', 'road', 'trees'], ['hill', 'up', 'road', 'trees', 'drive', 'go']),
    s('exp-site', 'explore', "Scoop digs into a pile of dirt at a dig site with cones around it, while Bump waits nearby.", ['Scoop', 'Bump'], ['dirt pile', 'cones'], ['dig', 'dirt', 'pile', 'cones', 'scoop', 'big']),
    s('exp-bridge', 'explore', "Bump drives across a small wooden bridge over a stream.", ['Bump'], ['bridge', 'stream'], ['bridge', 'water', 'drive', 'over', 'go']),
    s('find-mud', 'find', "A wide brown mud puddle covers the dirt road in front of Bump.", ['Bump'], ['mud puddle', 'dirt road'], ['mud', 'puddle', 'road', 'big', 'wet']),
    s('find-ball', 'find', "A red ball rolls across a dirt lot toward a deep hole, and Bump rolls after it.", ['Bump'], ['ball', 'hole', 'dirt'], ['ball', 'roll', 'red', 'hole', 'dirt', 'go']),
    s('find-rock', 'find', "A big round rock sits in the middle of the road ahead of Bump.", ['Bump'], ['rock', 'road'], ['rock', 'big', 'road', 'stop', 'in the way']),
    s('find-bumpy', 'find', "Bump drives over a bumpy road full of little rocks and holes.", ['Bump'], ['bumpy road', 'rocks'], ['bump', 'bumpy', 'rocks', 'road', 'hop']),
    s('prob-stuck', 'problem', "Bump's back wheels sink deep in the mud puddle and the truck tips a little.", ['Bump'], ['mud puddle'], ['stuck', 'mud', 'wheels', 'sink', 'oh no']),
    s('prob-hole', 'problem', "The red ball sits at the bottom of a deep hole, and Bump is parked at the edge.", ['Bump'], ['ball', 'hole'], ['ball', 'hole', 'deep', 'down', 'can not', 'get']),
    s('prob-rock', 'problem', "Bump is stopped right in front of the big round rock, and the road is blocked.", ['Bump'], ['rock', 'road'], ['stop', 'rock', 'block', 'road', 'big', 'can not go']),
    s('prob-flat', 'problem', "Bump is parked at the side of the road with one flat, droopy front tire.", ['Bump'], ['flat tire', 'road'], ['flat', 'tire', 'stop', 'oh no', 'wheel']),
    s('try-spin', 'try', "Bump's wheels spin in the mud and little drops of mud fly up behind it.", ['Bump'], ['mud puddle', 'mud drops'], ['spin', 'mud', 'wheels', 'try', 'go go']),
    s('try-reach', 'try', "Bump backs up to the hole and tips its bed down, but the bed does not reach the ball.", ['Bump'], ['hole', 'ball'], ['tip', 'back', 'reach', 'try', 'ball', 'deep']),
    s('try-beep', 'try', "Bump beeps at the big rock, with little sound lines coming from the horn, but the rock does not move.", ['Bump'], ['rock', 'road'], ['beep', 'honk', 'rock', 'try', 'move']),
    s('try-pump', 'try', "A small air pump stands by the road with its hose on Bump's flat tire, but the tire is still flat.", ['Bump'], ['air pump', 'hose', 'flat tire'], ['pump', 'air', 'tire', 'flat', 'try']),
    s('help-hook-mud', 'help', "Hook parks in front of Bump on the dry road and pulls Bump with its cable and hook.", ['Hook', 'Bump'], ['cable', 'hook', 'mud puddle'], ['pull', 'tow', 'hook', 'help', 'tug', 'mud']),
    s('help-scoop-hole', 'help', "Scoop reaches its long arm down into the deep hole with its bucket open.", ['Scoop'], ['hole', 'ball', 'bucket'], ['reach', 'arm', 'long', 'scoop', 'dig', 'help']),
    s('help-scoop-rock', 'help', "Scoop lifts the big round rock up in its bucket.", ['Scoop'], ['rock', 'bucket'], ['lift', 'rock', 'up', 'big', 'scoop', 'help']),
    s('help-hook-tow', 'help', "Hook tows Bump down the road with Bump's front wheels lifted up off the ground.", ['Hook', 'Bump'], ['road', 'hook'], ['tow', 'pull', 'road', 'help', 'go', 'garage']),
    s('solve-out', 'solve', "Bump sits on the dry road out of the puddle, with muddy wheels, next to Hook.", ['Bump', 'Hook'], ['road', 'mud puddle'], ['out', 'free', 'mud', 'wheels', 'did it']),
    s('solve-ball', 'solve', "Scoop holds its bucket up high with the red ball inside it.", ['Scoop'], ['ball', 'bucket'], ['ball', 'got it', 'up', 'red', 'bucket']),
    s('solve-clear', 'solve', "The road is open, the big rock sits on the grass beside it, and Bump drives past.", ['Bump'], ['rock', 'road', 'grass'], ['go', 'road', 'open', 'rock', 'drive']),
    s('solve-tire', 'solve', "Bump sits in the garage with a new round front tire, next to a stack of tires.", ['Bump'], ['tire', 'garage', 'stack of tires'], ['new', 'tire', 'fix', 'round', 'garage']),
    s('cel-wash', 'celebrate', "Bump rolls through a car wash with big round brushes and lots of bubbles.", ['Bump'], ['car wash', 'brushes', 'bubbles'], ['wash', 'bubbles', 'wet', 'clean', 'fun', 'scrub']),
    s('cel-parade', 'celebrate', "Bump, Scoop and Hook drive in a line down the road with little flags on top of their cabs.", ['Bump', 'Scoop', 'Hook'], ['road', 'flags'], ['line', 'flags', 'go', 'fun', 'yay', 'beep']),
    s('cel-ball-bed', 'celebrate', "Bump carries the red ball in its dump bed, and Scoop rolls beside it.", ['Bump', 'Scoop'], ['ball'], ['ball', 'ride', 'red', 'fun', 'yay']),
    s('rest-night', 'rest', "Bump, Scoop and Hook are parked inside the garage at night, with a moon in the window.", ['Bump', 'Scoop', 'Hook'], ['garage', 'moon', 'window'], ['night', 'moon', 'rest', 'sleep', 'garage']),
    s('rest-shade', 'rest', "Bump is parked in the shade under two round trees.", ['Bump'], ['trees', 'shade'], ['rest', 'shade', 'trees', 'stop', 'nap']),
    s('rest-lamp', 'rest', "Bump is parked by a street lamp at night under the stars.", ['Bump'], ['street lamp', 'stars'], ['night', 'stars', 'lamp', 'rest', 'still']),
    s('end-home', 'ending', "Bump drives down the road toward its garage.", ['Bump'], ['road', 'garage'], ['home', 'go', 'road', 'garage', 'bye']),
    s('end-row', 'ending', "Bump, Scoop and Hook are parked in a row facing the viewer with their headlights on.", ['Bump', 'Scoop', 'Hook'], ['road', 'headlights'], ['lights', 'friends', 'row', 'bye', 'see you']),
    s('end-beep-bye', 'ending', "Bump drives away down the road with little sound lines coming from its horn.", ['Bump'], ['road'], ['beep', 'bye', 'go', 'road', 'honk']),
  ],
  [
    path('mud', 'Stuck in the Mud', 'kindergarten', 'Bump gets stuck in a mud puddle and Hook pulls it out.',
      ['open-garage', 'exp-hill', 'find-mud', 'prob-stuck', 'try-spin', 'help-hook-mud', 'solve-out', 'cel-wash', 'end-home', 'rest-night']),
    path('ball', 'The Ball in the Hole', 'pre-k', 'A ball rolls into a deep hole and Scoop reaches it with its long arm.',
      ['open-road', 'exp-site', 'find-ball', 'prob-hole', 'try-reach', 'help-scoop-hole', 'solve-ball', 'cel-ball-bed']),
    path('rock', 'The Big Rock', 'pre-k', 'A big rock blocks the road and Scoop lifts it out of the way.',
      ['open-friends', 'find-rock', 'prob-rock', 'try-beep', 'help-scoop-rock', 'solve-clear', 'cel-parade', 'end-row']),
    path('flat', 'The Flat Tire', 'kindergarten', 'Bump gets a flat tire on a bumpy road and Hook tows it to the garage for a new one.',
      ['open-garage', 'exp-bridge', 'find-bumpy', 'prob-flat', 'try-pump', 'help-hook-tow', 'solve-tire', 'cel-parade', 'rest-shade', 'end-beep-bye']),
  ]);

const unicorns = build('unicorns',
  'A meadow of big flowers and soft hills under a rainbow, with a still pond and a little stream.',
  [
    { name: 'Puff', kind: 'unicorn', pronoun: 'she', icon: 'unicorn', describe: 'a small unicorn with a curly mane and tail, a spiral horn, big gentle eyes and a little star on her hip', words: ['Puff', 'unicorn', 'little unicorn', 'she', 'her'] },
    { name: 'Bun', kind: 'bunny', pronoun: 'he', describe: 'a little round bunny with long floppy ears and a fluffy round tail', words: ['Bun', 'bunny', 'rabbit', 'he', 'his'] },
    { name: 'Fluff', kind: 'cloud', pronoun: 'it', icon: 'cloud', describe: 'a small puffy cloud with a sweet round face and two tiny arms', words: ['Fluff', 'cloud', 'little cloud', 'it', 'its'] },
  ],
  [
    s('open-meadow', 'opening', "Puff stands in a flower meadow under a rainbow and smiles toward the viewer.", ['Puff'], ['flowers', 'rainbow'], ['rainbow', 'flowers', 'sun', 'fun', 'hi', 'meadow']),
    s('open-friends', 'opening', "Puff and Bun stand together on a hill, and Fluff floats just above them, all smiling toward the viewer.", ['Puff', 'Bun', 'Fluff'], ['hill'], ['friends', 'cloud', 'bunny', 'hill', 'three', 'hi']),
    s('open-wake', 'opening', "Puff wakes up on a bed of soft grass and stretches her front legs as the sun comes up over the hills.", ['Puff'], ['grass', 'sun', 'hills'], ['wake', 'up', 'sun', 'stretch', 'yawn', 'bed']),
    s('exp-hills', 'explore', "Puff trots over soft round hills with Bun riding on her back.", ['Puff', 'Bun'], ['hills'], ['trot', 'hop', 'ride', 'hills', 'run', 'fun']),
    s('exp-flowers', 'explore', "Bun sniffs a big flower while Puff watches with a smile.", ['Bun', 'Puff'], ['flowers'], ['sniff', 'flower', 'big', 'pink', 'smell']),
    s('exp-pond', 'explore', "Puff looks at her reflection in a still pond with lily pads.", ['Puff'], ['pond', 'lily pads'], ['pond', 'look', 'wet', 'lily pad', 'see']),
    s('find-star', 'find', "In the evening, Puff and Bun look down at a little star lying in the grass, with a moon in the sky.", ['Puff', 'Bun'], ['star', 'grass', 'moon'], ['star', 'find', 'little', 'grass', 'look', 'night']),
    s('find-stream', 'find', "Puff and Bun stand on one side of a wide stream, and a picnic blanket waits on the other side.", ['Puff', 'Bun'], ['stream', 'picnic blanket', 'stones'], ['stream', 'water', 'wide', 'other side', 'picnic']),
    s('find-kite', 'find', "Bun holds the string of a diamond kite flying above a hill while Puff watches.", ['Bun', 'Puff'], ['kite', 'string', 'hill'], ['kite', 'fly', 'up', 'string', 'wind', 'fun']),
    s('find-garden', 'find', "Puff and Bun look at a little garden of tall flowers by a fence.", ['Puff', 'Bun'], ['flowers', 'fence'], ['garden', 'flowers', 'tall', 'look', 'pretty']),
    s('prob-star-high', 'problem', "Puff holds the little star on her nose and looks up at the other stars far up in the night sky.", ['Puff'], ['star', 'night sky'], ['star', 'high', 'up', 'sky', 'far', 'home']),
    s('prob-stream', 'problem', "Puff stops at the edge of the wide stream, and Bun's ears droop.", ['Puff', 'Bun'], ['stream'], ['wide', 'water', 'stop', 'can not', 'cross']),
    s('prob-kite-tree', 'problem', "The diamond kite is stuck high in the branches of a tree, and Bun holds the loose string.", ['Bun'], ['kite', 'tree', 'string'], ['stuck', 'kite', 'tree', 'high', 'oh no']),
    s('prob-droopy', 'problem', "The flowers in the little garden droop down over dry, cracked ground. Puff and Bun watch nearby.", ['Puff', 'Bun'], ['droopy flowers', 'dry ground'], ['droop', 'dry', 'flowers', 'sad', 'thirsty']),
    s('try-star-hop', 'try', "Puff hops up high with the star on her nose, but the sky is still far above.", ['Puff'], ['star', 'night sky'], ['hop', 'jump', 'up', 'try', 'star']),
    s('try-jump-stream', 'try', "Bun jumps toward a stepping stone in the stream, but the next stone is too far away. Puff watches nearby.", ['Bun', 'Puff'], ['stream', 'stepping stones'], ['jump', 'hop', 'stone', 'far', 'try']),
    s('try-horn-reach', 'try', "Puff stands on her back legs and stretches her horn up toward the kite, but it is too high. Bun watches nearby.", ['Puff', 'Bun'], ['kite', 'tree'], ['reach', 'stretch', 'horn', 'high', 'try']),
    s('try-bucket', 'try', "Puff and Bun carry a little bucket of water between them, and drops drip out of a small hole.", ['Puff', 'Bun'], ['bucket', 'water drops'], ['bucket', 'water', 'drip', 'carry', 'try', 'wet']),
    s('help-fluff-star', 'help', "Fluff floats down from the sky and holds out its tiny arms for the little star. Puff watches nearby.", ['Fluff', 'Puff'], ['star', 'night sky'], ['float', 'down', 'cloud', 'help', 'star']),
    s('help-rainbow', 'help', "Puff's horn sparkles and a rainbow arch appears over the stream like a bridge. Bun watches nearby.", ['Puff', 'Bun'], ['rainbow', 'stream', 'sparkles'], ['rainbow', 'bridge', 'sparkle', 'magic', 'horn']),
    s('help-fluff-kite', 'help', "Fluff floats up to the top of the tree and tugs the kite free with its tiny arms.", ['Fluff'], ['kite', 'tree'], ['float', 'up', 'tug', 'cloud', 'help', 'kite']),
    s('help-fluff-rain', 'help', "Fluff floats over the garden and lets gentle raindrops fall on the flowers. Puff and Bun watch nearby.", ['Fluff', 'Puff', 'Bun'], ['raindrops', 'flowers'], ['rain', 'drops', 'wet', 'cloud', 'help', 'drip']),
    s('solve-star-sky', 'solve', "Fluff floats high and puts the little star back with the other stars, while Puff and Bun watch from below.", ['Fluff', 'Puff', 'Bun'], ['star', 'night sky'], ['star', 'back', 'sky', 'up', 'home', 'shine']),
    s('solve-cross', 'solve', "Puff and Bun walk across the rainbow bridge over the stream.", ['Puff', 'Bun'], ['rainbow', 'stream'], ['walk', 'cross', 'rainbow', 'over', 'did it']),
    s('solve-kite', 'solve', "Bun holds the kite string again and the kite flies high over the hill. Fluff floats nearby.", ['Bun', 'Fluff'], ['kite', 'string', 'hill'], ['kite', 'fly', 'up', 'got it', 'fun']),
    s('solve-flowers', 'solve', "The garden flowers stand tall and open wide, wet with raindrops. Puff and Bun watch nearby.", ['Puff', 'Bun'], ['flowers', 'raindrops'], ['flowers', 'tall', 'up', 'wet', 'open', 'yes']),
    s('cel-twinkle', 'celebrate', "Puff, Bun and Fluff look up at a night sky full of twinkling stars and a moon.", ['Puff', 'Bun', 'Fluff'], ['stars', 'moon'], ['stars', 'twinkle', 'shine', 'night', 'yay']),
    s('cel-picnic', 'celebrate', "Puff and Bun sit on the picnic blanket with a basket, carrots and cupcakes.", ['Puff', 'Bun'], ['picnic blanket', 'basket', 'carrots', 'cupcakes'], ['picnic', 'yum', 'carrot', 'cake', 'fun', 'sit']),
    s('cel-dance', 'celebrate', "Puff and Bun dance in a circle among the flowers, with little hearts around them.", ['Puff', 'Bun'], ['flowers', 'hearts'], ['dance', 'hop', 'spin', 'fun', 'yay', 'hearts']),
    s('cel-crowns', 'celebrate', "Puff and Bun wear crowns made of flowers, and Fluff smiles above them.", ['Puff', 'Bun', 'Fluff'], ['flower crowns'], ['crown', 'flowers', 'pretty', 'yay', 'wear']),
    s('rest-cloud-nap', 'rest', "Puff and Bun nap curled up in the grass, and Fluff floats above them like a soft blanket of shade.", ['Puff', 'Bun', 'Fluff'], ['grass'], ['nap', 'sleep', 'shade', 'rest', 'soft']),
    s('rest-night', 'rest', "Puff sleeps on the grass under the stars, with her horn glowing softly.", ['Puff'], ['stars', 'grass'], ['sleep', 'night', 'stars', 'rest', 'shh']),
    s('rest-burrow', 'rest', "Bun sleeps in a cozy burrow lined with soft leaves.", ['Bun'], ['burrow', 'leaves'], ['sleep', 'burrow', 'bed', 'nap', 'cozy']),
    s('end-wave', 'ending', "Puff, Bun and Fluff wave goodbye toward the viewer.", ['Puff', 'Bun', 'Fluff'], ['hill'], ['bye', 'wave', 'friends', 'see you']),
    s('end-rainbow-walk', 'ending', "Puff walks home along a winding path toward the hills, with a rainbow in the sky, and looks back toward the viewer.", ['Puff'], ['rainbow', 'hills', 'path'], ['home', 'walk', 'rainbow', 'path', 'bye']),
    s('end-hug', 'ending', "Puff and Bun hug, and Fluff smiles down at them.", ['Puff', 'Bun', 'Fluff'], ['grass'], ['hug', 'friends', 'love', 'happy']),
  ],
  [
    path('star', 'The Little Star', 'kindergarten', 'A little star falls into the meadow and Fluff floats it back up to the sky.',
      ['open-meadow', 'exp-hills', 'exp-pond', 'find-star', 'prob-star-high', 'try-star-hop', 'help-fluff-star', 'solve-star-sky', 'cel-twinkle', 'rest-night']),
    path('stream', 'The Rainbow Bridge', 'pre-k', 'A stream is too wide to cross until Puff makes a rainbow bridge.',
      ['open-wake', 'exp-flowers', 'find-stream', 'prob-stream', 'try-jump-stream', 'help-rainbow', 'solve-cross', 'cel-picnic']),
    path('kite', 'The Kite in the Tree', 'pre-k', 'Bun\'s kite gets stuck in a tree and Fluff floats up to tug it free.',
      ['open-friends', 'find-kite', 'prob-kite-tree', 'try-horn-reach', 'help-fluff-kite', 'solve-kite', 'end-wave']),
    path('flowers', 'Thirsty Flowers', 'kindergarten', 'The garden flowers droop in the dry ground until Fluff brings gentle rain.',
      ['open-meadow', 'exp-pond', 'find-garden', 'prob-droopy', 'try-bucket', 'help-fluff-rain', 'solve-flowers', 'cel-crowns', 'cel-dance', 'rest-cloud-nap', 'end-hug']),
  ]);

const ocean = build('ocean',
  'A sandy beach with gentle waves, tide pools, and under the water a coral reef, seaweed and a sandy sea floor.',
  [
    { name: 'Snip', kind: 'crab', pronoun: 'he', icon: 'crab', describe: 'a little round crab with eyes on short stalks, two small rounded claws and six short legs', words: ['Snip', 'crab', 'little crab', 'he', 'his'] },
    { name: 'Flip', kind: 'sea turtle', pronoun: 'she', icon: 'turtle', describe: 'a young sea turtle with a shell of six-sided patches, four wide flippers and a kind smile', words: ['Flip', 'turtle', 'sea turtle', 'she', 'her'] },
    { name: 'Gup', kind: 'fish', pronoun: 'he', icon: 'fish', describe: 'a small round fish with big eyes, striped fins and a fan-shaped tail', words: ['Gup', 'fish', 'little fish', 'he', 'his'] },
  ],
  [
    s('open-beach', 'opening', "Snip stands on the sandy beach by the gentle waves and waves one claw toward the viewer.", ['Snip'], ['sand', 'waves', 'sun'], ['sand', 'sun', 'wave', 'beach', 'hi', 'hot']),
    s('open-friends', 'opening', "Snip, Flip and Gup are together by a coral reef under the water, smiling toward the viewer.", ['Snip', 'Flip', 'Gup'], ['coral', 'bubbles'], ['friends', 'sea', 'coral', 'swim', 'three', 'hi']),
    s('open-reef', 'opening', "Gup swims out of a round hole in his coral home, with bubbles rising around him.", ['Gup'], ['coral', 'bubbles'], ['swim', 'coral', 'home', 'bubbles', 'out', 'fin']),
    s('exp-swim', 'explore', "Flip swims through the water with Snip riding on her shell and Gup swimming beside them.", ['Flip', 'Snip', 'Gup'], ['water', 'bubbles'], ['swim', 'ride', 'shell', 'go', 'fins', 'fun']),
    s('exp-seaweed', 'explore', "Gup swims between tall wavy strands of seaweed on the sea floor.", ['Gup'], ['seaweed', 'sand'], ['seaweed', 'swim', 'tall', 'zig zag', 'fin']),
    s('exp-tidepool', 'explore', "Snip peeks into a tide pool with a starfish and little shells in it.", ['Snip'], ['tide pool', 'starfish', 'shells'], ['pool', 'starfish', 'peek', 'wet', 'shells', 'look']),
    s('find-shell', 'find', "Snip holds up a big spiral shell on the sand with both claws.", ['Snip'], ['spiral shell', 'sand'], ['shell', 'big', 'find', 'sand', 'look', 'got']),
    s('find-chest', 'find', "A small wooden treasure chest sits half buried in the sand on the sea floor, and Snip and Gup look at it.", ['Snip', 'Gup'], ['treasure chest', 'sand'], ['chest', 'box', 'sand', 'find', 'look', 'what is it']),
    s('find-ball', 'find', "Snip pushes a striped beach ball across the sand.", ['Snip'], ['beach ball', 'sand'], ['ball', 'push', 'sand', 'roll', 'fun']),
    s('find-gup-gone', 'find', "Snip and Flip look around the coral home, and a trail of tiny bubbles leads away into the water.", ['Snip', 'Flip'], ['coral', 'bubbles'], ['look', 'where', 'bubbles', 'coral', 'home', 'gone']),
    s('prob-shell-wave', 'problem', "A wave carries the spiral shell out into the water as Snip reaches for it.", ['Snip'], ['spiral shell', 'wave', 'sand'], ['wave', 'shell', 'away', 'oh no', 'wet', 'far']),
    s('prob-chest-stuck', 'problem', "Snip tugs on the lid of the treasure chest with his claws, but it stays shut. Gup watches nearby.", ['Snip', 'Gup'], ['treasure chest'], ['stuck', 'shut', 'lid', 'tug', 'can not']),
    s('prob-ball-far', 'problem', "The beach ball floats far out on the water, and Snip stands at the edge of the waves.", ['Snip'], ['beach ball', 'waves'], ['far', 'ball', 'float', 'water', 'away', 'oh no']),
    s('prob-gup-lost', 'problem', "Gup swims alone among big rocks, looking all around, far from the coral.", ['Gup'], ['rocks', 'water'], ['lost', 'alone', 'rocks', 'look', 'where', 'home']),
    s('try-shell-wade', 'try', "Snip walks into the shallow water reaching out, but the shell bobs farther away.", ['Snip'], ['spiral shell', 'water'], ['wade', 'reach', 'wet', 'try', 'far']),
    s('try-chest-pull', 'try', "Snip pulls the lid with his claws while Gup pushes with his fins, and the lid stays shut.", ['Snip', 'Gup'], ['treasure chest'], ['pull', 'push', 'try', 'lid', 'fins', 'tug']),
    s('try-ball-reach', 'try', "Snip stands on a rock at the edge of the water stretching his claws toward the ball, but it is too far.", ['Snip'], ['rock', 'beach ball', 'water'], ['reach', 'rock', 'far', 'try', 'claws']),
    s('try-look-rocks', 'try', "Snip and Flip peek behind a big rock, but only a starfish is there.", ['Snip', 'Flip'], ['rock', 'starfish'], ['look', 'peek', 'rock', 'not here', 'starfish']),
    s('help-flip-shell', 'help', "Flip swims out and comes back with the spiral shell resting on her back.", ['Flip'], ['spiral shell', 'water'], ['swim', 'help', 'shell', 'back', 'bring']),
    s('help-flip-chest', 'help', "Flip pushes the lid of the treasure chest up with her head while Snip and Gup watch.", ['Flip', 'Snip', 'Gup'], ['treasure chest'], ['push', 'up', 'help', 'lid', 'strong']),
    s('help-flip-ball', 'help', "Flip swims behind the beach ball and pushes it toward the beach with her nose.", ['Flip'], ['beach ball', 'water'], ['push', 'nose', 'swim', 'help', 'ball']),
    s('help-bubbles', 'help', "Flip and Snip follow a line of tiny bubbles past the seaweed.", ['Flip', 'Snip'], ['bubbles', 'seaweed'], ['follow', 'bubbles', 'swim', 'look', 'this way']),
    s('solve-shell', 'solve', "Snip hugs the spiral shell on the sand, and Flip smiles beside him.", ['Snip', 'Flip'], ['spiral shell', 'sand'], ['hug', 'shell', 'got it', 'back', 'happy']),
    s('solve-chest-open', 'solve', "The treasure chest is open and full of shiny shells and round pearls. Snip, Flip and Gup watch nearby.", ['Snip', 'Flip', 'Gup'], ['treasure chest', 'shells', 'pearls'], ['open', 'pearls', 'shells', 'shiny', 'wow']),
    s('solve-ball-back', 'solve', "The beach ball sits on the sand, and Snip and Flip are next to it.", ['Snip', 'Flip'], ['beach ball', 'sand'], ['ball', 'back', 'sand', 'got it', 'yes']),
    s('solve-gup-found', 'solve', "Gup peeks out from the seaweed and swims toward Snip and Flip.", ['Gup', 'Snip', 'Flip'], ['seaweed'], ['found', 'peek', 'swim', 'there you are', 'happy']),
    s('cel-bubbles', 'celebrate', "Snip, Flip and Gup swirl and dance in the water with bubbles all around.", ['Snip', 'Flip', 'Gup'], ['bubbles'], ['dance', 'spin', 'bubbles', 'fun', 'yay']),
    s('cel-ball-game', 'celebrate', "Snip, Flip and Gup play with the beach ball, and the ball is up in the air.", ['Snip', 'Flip', 'Gup'], ['beach ball'], ['play', 'ball', 'up', 'hit', 'fun']),
    s('cel-pearls', 'celebrate', "Snip, Flip and Gup line up the shells and pearls in a row on the sand.", ['Snip', 'Flip', 'Gup'], ['shells', 'pearls', 'sand'], ['row', 'pearls', 'shells', 'count', 'pretty']),
    s('cel-home', 'celebrate', "Snip, Flip and Gup swim back to the coral home together.", ['Snip', 'Flip', 'Gup'], ['coral', 'bubbles'], ['home', 'swim', 'together', 'coral', 'yay']),
    s('rest-sand-nap', 'rest', "Snip naps in a small hollow in the sand with his eyes closed.", ['Snip'], ['sand'], ['nap', 'sand', 'sleep', 'rest', 'hot', 'sun']),
    s('rest-moon', 'rest', "Snip and Flip rest on the beach at night under a moon and stars, with small waves behind them.", ['Snip', 'Flip'], ['moon', 'stars', 'waves'], ['night', 'moon', 'rest', 'stars', 'sleepy']),
    s('rest-coral-sleep', 'rest', "Gup sleeps inside his coral home while seaweed sways nearby.", ['Gup'], ['coral', 'seaweed'], ['sleep', 'home', 'coral', 'nap', 'shh']),
    s('end-wave', 'ending', "Snip, Flip and Gup wave goodbye toward the viewer.", ['Snip', 'Flip', 'Gup'], ['water', 'bubbles'], ['bye', 'wave', 'friends', 'see you']),
    s('end-swim-away', 'ending', "Flip swims away with Snip on her shell, and they both look back toward the viewer.", ['Flip', 'Snip'], ['water'], ['swim', 'bye', 'away', 'ride']),
    s('end-beach', 'ending', "Snip stands on the beach beside a line of little crab tracks and waves toward the viewer.", ['Snip'], ['sand', 'tracks', 'waves'], ['bye', 'tracks', 'sand', 'wave', 'beach']),
  ],
  [
    path('shell', 'The Spiral Shell', 'pre-k', 'A wave carries Snip\'s new shell away and Flip swims out to bring it back.',
      ['open-beach', 'exp-tidepool', 'find-shell', 'prob-shell-wave', 'try-shell-wade', 'help-flip-shell', 'solve-shell', 'rest-sand-nap']),
    path('chest', 'The Treasure Chest', 'kindergarten', 'A treasure chest is stuck shut until Flip pushes the lid up.',
      ['open-friends', 'exp-seaweed', 'find-chest', 'prob-chest-stuck', 'try-chest-pull', 'help-flip-chest', 'solve-chest-open', 'cel-pearls', 'rest-coral-sleep', 'end-wave']),
    path('ball', 'The Floating Ball', 'pre-k', 'The beach ball floats out too far and Flip pushes it back.',
      ['open-beach', 'find-ball', 'prob-ball-far', 'try-ball-reach', 'help-flip-ball', 'solve-ball-back', 'cel-ball-game']),
    path('gup', 'Where Is Gup?', 'kindergarten', 'Gup swims too far from home and his friends follow his bubbles to find him.',
      ['open-friends', 'exp-swim', 'find-gup-gone', 'prob-gup-lost', 'try-look-rocks', 'help-bubbles', 'solve-gup-found', 'cel-home', 'rest-coral-sleep', 'end-swim-away']),
  ]);

const space = build('space',
  'A gray moon with round craters, a small rocket, and a black sky full of stars with a ringed planet and a round cloudy planet.',
  [
    { name: 'Blip', kind: 'alien', pronoun: 'he', icon: 'alien', describe: 'a little round alien with big round eyes, one antenna with a ball on top, short arms and short legs', words: ['Blip', 'alien', 'little alien', 'he', 'his'] },
    { name: 'Beep', kind: 'robot', pronoun: 'it', describe: 'a small boxy robot with a round head, a light on top, a round screen on its chest, two bendy arms and wheels for feet', words: ['Beep', 'robot', 'it', 'its'] },
  ],
  [
    s('open-rocket', 'opening', "Blip stands next to a small rocket on the moon, among round craters, and waves toward the viewer.", ['Blip'], ['rocket', 'craters', 'moon'], ['rocket', 'moon', 'hi', 'wave', 'big', 'up']),
    s('open-friends', 'opening', "Blip and Beep stand together on the moon in front of their rocket, with a round cloudy planet in the sky.", ['Blip', 'Beep'], ['rocket', 'moon', 'planet'], ['friends', 'moon', 'rocket', 'robot', 'alien', 'hi']),
    s('open-liftoff', 'opening', "The rocket lifts off from a launch pad with puffy clouds of smoke below it, and Blip and Beep look out of its round window.", ['Blip', 'Beep'], ['rocket', 'launch pad', 'smoke clouds'], ['up', 'go', 'rocket', 'zoom', 'blast off', 'window']),
    s('exp-fly', 'explore', "The rocket flies past stars and a ringed planet, and Blip and Beep look out of the round window.", ['Blip', 'Beep'], ['rocket', 'stars', 'ringed planet'], ['fly', 'stars', 'planet', 'zoom', 'look', 'rings']),
    s('exp-moonwalk', 'explore', "Blip bounces high over the moon craters, and Beep rolls along behind him.", ['Blip', 'Beep'], ['craters', 'moon'], ['hop', 'bounce', 'moon', 'up', 'fun', 'roll']),
    s('exp-comet', 'explore', "A comet with a long tail zips across the sky, and Blip and Beep point up at it.", ['Blip', 'Beep'], ['comet', 'stars'], ['comet', 'zip', 'tail', 'point', 'look', 'wow']),
    s('find-ball', 'find', "Blip tosses a ball up on the moon and it floats slowly above his hands.", ['Blip'], ['ball', 'moon'], ['ball', 'toss', 'up', 'float', 'play']),
    s('find-crater', 'find', "Beep rolls up to the edge of a big round crater and Blip walks behind.", ['Beep', 'Blip'], ['crater', 'moon'], ['crater', 'hole', 'big', 'edge', 'roll', 'look']),
    s('find-far-planet', 'find', "Blip stands on the moon and points far into the sky at a tiny dot of a planet.", ['Blip'], ['tiny planet', 'stars'], ['planet', 'far', 'point', 'tiny', 'look', 'what']),
    s('find-seed', 'find', "Blip holds a tiny seed over a little flower pot of dirt on the moon, and Beep watches.", ['Blip', 'Beep'], ['seed', 'flower pot', 'dirt'], ['seed', 'pot', 'dirt', 'plant', 'tiny', 'grow']),
    s('prob-ball-floats', 'problem', "The ball floats away high up among the stars, and Blip reaches up after it.", ['Blip'], ['ball', 'stars'], ['float', 'away', 'up', 'ball', 'oh no', 'high']),
    s('prob-crater', 'problem', "Beep sits at the bottom of the crater with its wheels on the steep side, and Blip looks down from the top.", ['Beep', 'Blip'], ['crater'], ['stuck', 'down', 'steep', 'crater', 'can not', 'up']),
    s('prob-too-far', 'problem', "Blip squints at the tiny dot of a planet far away.", ['Blip'], ['tiny planet', 'stars'], ['far', 'tiny', 'see', 'can not', 'squint']),
    s('prob-no-grow', 'problem', "The flower pot holds only dirt with nothing growing, and Blip looks at it with a sad face.", ['Blip'], ['flower pot', 'dirt'], ['pot', 'dirt', 'not yet', 'sad', 'grow', 'dark']),
    s('try-ball-jump', 'try', "Blip jumps high off the moon reaching for the ball, but it is still above him.", ['Blip'], ['ball', 'moon'], ['jump', 'reach', 'up', 'try', 'high']),
    s('try-pull-beep', 'try', "Blip holds Beep's bendy arm at the edge of the crater and pulls.", ['Blip', 'Beep'], ['crater'], ['pull', 'tug', 'try', 'arm', 'up']),
    s('try-tiptoe', 'try', "Blip stands on tiptoe on top of a big moon rock, still squinting at the tiny planet.", ['Blip'], ['moon rock', 'tiny planet'], ['tiptoe', 'rock', 'up', 'try', 'look', 'far']),
    s('try-water', 'try', "Blip pours water from a small cup into the flower pot.", ['Blip'], ['cup', 'water', 'flower pot'], ['water', 'pour', 'cup', 'wet', 'try', 'drip']),
    s('help-rocket-ball', 'help', "Blip and Beep fly the rocket up toward the floating ball, looking out of the window.", ['Blip', 'Beep'], ['rocket', 'ball', 'stars'], ['fly', 'rocket', 'up', 'go', 'help', 'zoom']),
    s('help-rope', 'help', "A rope runs from the rocket down into the crater, and Beep holds the end of it. Blip watches nearby.", ['Beep', 'Blip'], ['rope', 'rocket', 'crater'], ['rope', 'pull', 'help', 'rocket', 'hold', 'tug']),
    s('help-telescope', 'help', "Beep rolls up to Blip carrying a telescope in its bendy arms.", ['Beep', 'Blip'], ['telescope', 'moon'], ['telescope', 'bring', 'help', 'look', 'roll']),
    s('help-light', 'help', "The light on Beep's head shines a bright beam onto the flower pot. Blip watches nearby.", ['Beep', 'Blip'], ['flower pot', 'light beam'], ['light', 'shine', 'bright', 'help', 'sun', 'beam']),
    s('solve-grab-ball', 'solve', "Beep reaches its long bendy arm out of the rocket door and catches the ball, and Blip looks out of the round window.", ['Beep', 'Blip'], ['rocket', 'ball'], ['catch', 'got it', 'arm', 'grab', 'ball', 'yes']),
    s('solve-out-crater', 'solve', "Beep rolls out of the crater onto the flat moon next to Blip, with the rope loose behind it.", ['Beep', 'Blip'], ['crater', 'rope'], ['out', 'up', 'did it', 'roll', 'free']),
    s('solve-see-planet', 'solve', "Blip looks through the telescope on its stand, pointed at a big ringed planet in the sky. Beep watches nearby.", ['Blip', 'Beep'], ['telescope', 'ringed planet'], ['see', 'look', 'planet', 'rings', 'big', 'wow']),
    s('solve-sprout', 'solve', "A small sprout with two leaves pops up out of the flower pot. Blip and Beep watch nearby.", ['Blip', 'Beep'], ['flower pot', 'sprout'], ['sprout', 'grow', 'leaves', 'pop', 'up', 'yes']),
    s('cel-flower', 'celebrate', "A big flower blooms in the pot, and Blip and Beep dance beside it.", ['Blip', 'Beep'], ['flower', 'flower pot'], ['flower', 'big', 'dance', 'yay', 'grow']),
    s('cel-float-dance', 'celebrate', "Blip and Beep float and twirl together among the stars.", ['Blip', 'Beep'], ['stars'], ['float', 'spin', 'dance', 'stars', 'fun']),
    s('cel-catch', 'celebrate', "Blip and Beep play catch with the ball on the moon.", ['Blip', 'Beep'], ['ball', 'moon'], ['catch', 'toss', 'ball', 'play', 'fun']),
    s('rest-bunk', 'rest', "Blip sleeps in a little bunk inside the rocket, with stars outside the round window.", ['Blip'], ['bunk', 'window', 'stars'], ['sleep', 'bed', 'night', 'stars', 'rest']),
    s('rest-moon-nap', 'rest', "Blip and Beep lie on the moon looking up at the round cloudy planet.", ['Blip', 'Beep'], ['moon', 'planet'], ['rest', 'lie', 'look', 'planet', 'sleepy']),
    s('rest-charge', 'rest', "Beep sits plugged into a charger with its light off, and Blip sleeps beside it.", ['Beep', 'Blip'], ['charger', 'cord'], ['rest', 'charge', 'sleep', 'nap', 'shh']),
    s('end-fly-home', 'ending', "The rocket flies toward the big round cloudy planet, with Blip and Beep looking out of its round window.", ['Blip', 'Beep'], ['rocket', 'planet', 'stars'], ['home', 'fly', 'rocket', 'go', 'bye']),
    s('end-wave', 'ending', "Blip and Beep wave goodbye toward the viewer from the rocket window.", ['Blip', 'Beep'], ['rocket', 'window'], ['bye', 'wave', 'window', 'see you']),
    s('end-landing', 'ending', "The rocket lands softly on a grassy hill with puffy clouds below it, and Blip waves from the door.", ['Blip'], ['rocket', 'hill', 'clouds'], ['land', 'home', 'hill', 'bye', 'down']),
  ],
  [
    path('ball', 'The Floating Ball', 'kindergarten', 'Blip\'s ball floats away into space and Beep catches it from the rocket.',
      ['open-friends', 'exp-moonwalk', 'find-ball', 'prob-ball-floats', 'try-ball-jump', 'help-rocket-ball', 'solve-grab-ball', 'cel-catch', 'rest-moon-nap', 'end-wave']),
    path('crater', 'Down in the Crater', 'pre-k', 'Beep rolls into a crater and the rocket pulls it out with a rope.',
      ['open-rocket', 'exp-moonwalk', 'find-crater', 'prob-crater', 'try-pull-beep', 'help-rope', 'solve-out-crater', 'rest-charge']),
    path('planet', 'The Far Planet', 'kindergarten', 'A planet is too far away to see until Beep brings a telescope.',
      ['open-liftoff', 'exp-fly', 'exp-comet', 'find-far-planet', 'prob-too-far', 'try-tiptoe', 'help-telescope', 'solve-see-planet', 'cel-float-dance', 'rest-moon-nap', 'end-fly-home']),
    path('seed', 'A Seed on the Moon', 'pre-k', 'A seed will not grow on the dark moon until Beep shines its light on it.',
      ['open-rocket', 'find-seed', 'prob-no-grow', 'try-water', 'help-light', 'solve-sprout', 'cel-flower', 'rest-bunk']),
  ]);

const farm = build('farm',
  'A farm with a big barn, a wooden fence and gate, a hen house with a ramp, haystacks, a duck pond and an apple tree.',
  [
    { name: 'Pip', kind: 'piglet', pronoun: 'he', icon: 'pig', describe: 'a little round piglet with floppy ears, a round snout and a curly tail', words: ['Pip', 'pig', 'piglet', 'little pig', 'he', 'his'] },
    { name: 'Peck', kind: 'hen', pronoun: 'she', icon: 'hen', describe: 'a small plump hen with a tiny comb on her head, short wings and fluffy tail feathers', words: ['Peck', 'hen', 'chicken', 'she', 'her'] },
    { name: 'Moo', kind: 'cow', pronoun: 'she', icon: 'cow', describe: 'a gentle cow with big round spots, small horns, floppy ears and a bell on her collar', words: ['Moo', 'cow', 'she', 'her'] },
  ],
  [
    s('open-barn', 'opening', "Pip stands in front of a big barn with its doors open and smiles toward the viewer.", ['Pip'], ['barn'], ['barn', 'pig', 'hi', 'farm', 'big']),
    s('open-friends', 'opening', "Pip, Peck and Moo stand by a wooden fence in the morning sun, smiling toward the viewer.", ['Pip', 'Peck', 'Moo'], ['fence', 'sun'], ['friends', 'farm', 'fence', 'sun', 'three', 'hi']),
    s('open-wake', 'opening', "Peck sits on her straw nest in the hen house as the sun comes up outside the little window.", ['Peck'], ['hen house', 'nest', 'straw', 'sun'], ['hen', 'nest', 'sun', 'up', 'morning', 'wake']),
    s('exp-field', 'explore', "Pip trots by himself through tall grass after a butterfly.", ['Pip'], ['tall grass', 'butterfly'], ['run', 'trot', 'grass', 'tall', 'fun', 'hop']),
    s('exp-pond', 'explore', "Pip and Peck stand at the edge of a pond where ducks are swimming.", ['Pip', 'Peck'], ['pond', 'ducks'], ['pond', 'ducks', 'swim', 'wet', 'quack']),
    s('exp-tractor', 'explore', "Pip, Peck and Moo walk past a parked tractor and round haystacks.", ['Pip', 'Peck', 'Moo'], ['tractor', 'haystacks'], ['walk', 'tractor', 'hay', 'big', 'farm']),
    s('find-egg', 'find', "Peck stands beside one smooth egg in her straw nest, looking proud.", ['Peck'], ['egg', 'nest', 'straw'], ['egg', 'nest', 'hen', 'one', 'look']),
    s('find-gate', 'find', "Pip stands in the field in front of a closed gate, and Moo and Peck are on the other side of the fence.", ['Pip', 'Moo', 'Peck'], ['gate', 'fence', 'field'], ['gate', 'fence', 'shut', 'other side', 'look']),
    s('find-apple-tree', 'find', "Pip, Peck and Moo look up at a big apple tree with round apples on its branches.", ['Pip', 'Peck', 'Moo'], ['apple tree', 'apples'], ['apple', 'tree', 'up', 'red', 'yum', 'look']),
    s('find-bell', 'find', "Moo shakes her head in the field and the bell on her collar rings, with little sound lines around it.", ['Moo'], ['bell', 'collar', 'field'], ['bell', 'ring', 'ding', 'shake', 'cow']),
    s('prob-egg-rolls', 'problem', "The egg rolls down the hen house ramp toward a pile of hay, and Peck flaps her wings.", ['Peck'], ['egg', 'ramp', 'hay'], ['egg', 'roll', 'down', 'oh no', 'ramp', 'hay']),
    s('prob-gate-shut', 'problem', "Pip pushes his snout on the closed gate, but the latch keeps it shut.", ['Pip'], ['gate', 'latch'], ['shut', 'push', 'gate', 'can not', 'stuck']),
    s('prob-apples-high', 'problem', "Pip stands under the apple tree looking up, and the apples are far above his head.", ['Pip'], ['apple tree', 'apples'], ['high', 'up', 'apple', 'can not', 'reach']),
    s('prob-bell-lost', 'problem', "Moo stands with an empty collar and no bell, looking around beside a big haystack.", ['Moo'], ['collar', 'haystack'], ['bell', 'gone', 'lost', 'where', 'hay']),
    s('try-look-hay', 'try', "Pip and Peck look around a big pile of hay.", ['Pip', 'Peck'], ['hay'], ['look', 'hay', 'where', 'pile', 'try']),
    s('try-squeeze', 'try', "Pip pushes his nose under the gate, but the gap is too small.", ['Pip'], ['gate'], ['squeeze', 'under', 'small', 'try', 'nose']),
    s('try-jump-apple', 'try', "Pip jumps up and Peck flaps up a little under the apple tree, still far below the apples.", ['Pip', 'Peck'], ['apple tree', 'apples'], ['jump', 'flap', 'hop', 'try', 'up']),
    s('try-moo-looks', 'try', "Moo looks in the tall grass with her nose down.", ['Moo'], ['tall grass'], ['look', 'sniff', 'grass', 'try', 'where']),
    s('help-pip-sniff', 'help', "Pip sniffs the hay with his snout, and the egg peeks out from under the hay.", ['Pip'], ['hay', 'egg'], ['sniff', 'snout', 'egg', 'help', 'find']),
    s('help-moo-latch', 'help', "Moo leans over the fence and nudges the gate latch up with her nose. Pip watches nearby.", ['Moo', 'Pip'], ['gate', 'latch', 'fence'], ['nudge', 'nose', 'latch', 'help', 'open']),
    s('help-moo-shake', 'help', "Moo bumps the apple tree trunk gently with her head, and apples fall from the branches. Pip and Peck watch nearby.", ['Moo', 'Pip', 'Peck'], ['apple tree', 'apples'], ['bump', 'shake', 'fall', 'apples', 'help', 'down']),
    s('help-peck-hay', 'help', "Peck pecks through the haystack, and the bell peeks out. Moo watches nearby.", ['Peck', 'Moo'], ['haystack', 'bell'], ['peck', 'hay', 'bell', 'find', 'help']),
    s('solve-egg-nest', 'solve', "Peck sits on the egg in her straw nest again, with Pip beside the nest.", ['Peck', 'Pip'], ['egg', 'nest'], ['egg', 'nest', 'back', 'safe', 'sit']),
    s('solve-gate-open', 'solve', "The gate is open and Pip trots through to Moo and Peck.", ['Pip', 'Moo', 'Peck'], ['gate', 'fence'], ['open', 'gate', 'trot', 'in', 'did it']),
    s('solve-apples', 'solve', "Round apples lie on the soft grass, and Pip holds one in his snout. Moo and Peck watch nearby.", ['Pip', 'Moo', 'Peck'], ['apples', 'grass'], ['apples', 'got', 'grass', 'yum', 'red']),
    s('solve-bell-on', 'solve', "Moo wears her bell on her collar again, and Peck sits on her back.", ['Moo', 'Peck'], ['bell', 'collar'], ['bell', 'back', 'on', 'yes', 'ding']),
    s('cel-chick', 'celebrate', "The egg cracks and a fluffy chick peeks out, with Peck and Pip close by.", ['Peck', 'Pip'], ['egg', 'chick', 'nest', 'shell'], ['chick', 'crack', 'hatch', 'peep', 'baby', 'yay']),
    s('cel-apple-snack', 'celebrate', "Pip, Peck and Moo share apples under the tree.", ['Pip', 'Peck', 'Moo'], ['apples', 'apple tree'], ['eat', 'apple', 'yum', 'share', 'munch']),
    s('cel-mud', 'celebrate', "Pip splashes happily in a mud puddle while Peck and Moo watch.", ['Pip', 'Peck', 'Moo'], ['mud puddle'], ['mud', 'splash', 'fun', 'pig', 'wet', 'yay']),
    s('cel-bell-ring', 'celebrate', "Moo shakes her head and her bell rings, while Pip and Peck dance beside her.", ['Moo', 'Pip', 'Peck'], ['bell'], ['ring', 'ding', 'dance', 'bell', 'fun']),
    s('rest-hay-nap', 'rest', "Pip naps in a pile of hay inside the barn.", ['Pip'], ['hay', 'barn'], ['nap', 'hay', 'sleep', 'barn', 'rest']),
    s('rest-hen-house', 'rest', "Peck and the fluffy chick sleep together in the straw nest.", ['Peck'], ['chick', 'nest', 'straw'], ['sleep', 'nest', 'chick', 'shh', 'night']),
    s('rest-moon-barn', 'rest', "Moo lies down in the field at night beside the barn, with a moon and stars above.", ['Moo'], ['barn', 'moon', 'stars'], ['night', 'moon', 'rest', 'sleep', 'barn']),
    s('end-wave', 'ending', "Pip, Peck and Moo stand by the fence and wave goodbye toward the viewer.", ['Pip', 'Peck', 'Moo'], ['fence'], ['bye', 'wave', 'friends', 'see you']),
    s('end-barn', 'ending', "Pip, Peck and Moo walk into the barn through the big open doors.", ['Pip', 'Peck', 'Moo'], ['barn'], ['barn', 'in', 'home', 'walk', 'bye']),
    s('end-hug', 'ending', "Pip leans against Moo's leg, and Peck sits on Moo's back.", ['Pip', 'Moo', 'Peck'], ['grass'], ['hug', 'friends', 'love', 'happy']),
  ],
  [
    path('egg', 'The Rolling Egg', 'pre-k', 'Peck\'s egg rolls into the hay, Pip sniffs it out, and it hatches.',
      ['open-wake', 'find-egg', 'prob-egg-rolls', 'try-look-hay', 'help-pip-sniff', 'solve-egg-nest', 'cel-chick', 'rest-hen-house']),
    path('gate', 'The Shut Gate', 'pre-k', 'Pip is on the wrong side of a shut gate until Moo nudges the latch open.',
      ['open-barn', 'exp-field', 'find-gate', 'prob-gate-shut', 'try-squeeze', 'help-moo-latch', 'solve-gate-open', 'end-hug']),
    path('apples', 'Apples Up High', 'kindergarten', 'The apples are too high to reach until Moo bumps the tree.',
      ['open-friends', 'exp-pond', 'find-apple-tree', 'prob-apples-high', 'try-jump-apple', 'help-moo-shake', 'solve-apples', 'cel-apple-snack', 'rest-hay-nap', 'end-wave']),
    path('bell', 'The Lost Bell', 'kindergarten', 'Moo loses her bell in the hay and Peck pecks until she finds it.',
      ['open-barn', 'exp-tractor', 'find-bell', 'prob-bell-lost', 'try-moo-looks', 'help-peck-hay', 'solve-bell-on', 'cel-bell-ring', 'cel-mud', 'rest-moon-barn', 'end-barn']),
  ]);

const bugs = build('bugs',
  'A garden with big leaves, tall flowers, mushrooms, a stone path, a puddle and a round beehive hanging from a branch.',
  [
    { name: 'Spot', kind: 'ladybug', pronoun: 'she', icon: 'ladybug', describe: 'a little round ladybug with big round spots on her shell, two short antennae and a smiling face', words: ['Spot', 'ladybug', 'bug', 'little ladybug', 'she', 'her'] },
    { name: 'Buzz', kind: 'bee', pronoun: 'he', icon: 'bee', describe: 'a fuzzy round bee with stripes, two small see-through wings and two curly antennae', words: ['Buzz', 'bee', 'he', 'his'] },
    { name: 'Inch', kind: 'caterpillar', pronoun: 'he', icon: 'caterpillar', describe: 'a chubby caterpillar made of round segments, with two short antennae and lots of tiny feet', words: ['Inch', 'caterpillar', 'bug', 'he', 'his'] },
  ],
  [
    s('open-garden', 'opening', "Spot sits on a big leaf in a garden full of flowers and waves toward the viewer.", ['Spot'], ['leaf', 'flowers'], ['leaf', 'bug', 'hi', 'garden', 'sun']),
    s('open-friends', 'opening', "Spot, Buzz and Inch sit together on a garden rock and smile toward the viewer.", ['Spot', 'Buzz', 'Inch'], ['rock', 'flowers'], ['friends', 'bugs', 'rock', 'three', 'hi']),
    s('open-hive', 'opening', "Buzz flies out of a round beehive hanging from a branch as the sun comes up.", ['Buzz'], ['beehive', 'branch', 'sun'], ['bee', 'hive', 'fly', 'buzz', 'sun', 'up']),
    s('exp-flowers', 'explore', "Buzz flies from flower to flower, with dotted lines showing his path.", ['Buzz'], ['flowers'], ['fly', 'flower', 'buzz', 'zip', 'zig zag']),
    s('exp-path', 'explore', "Spot and Inch walk along a stone path past little mushrooms and a snail.", ['Spot', 'Inch'], ['stone path', 'mushrooms', 'snail'], ['walk', 'path', 'snail', 'mushroom', 'go']),
    s('exp-puddle', 'explore', "Spot and Buzz look at a small puddle with a lily pad and a dragonfly on a reed.", ['Spot', 'Buzz'], ['puddle', 'lily pad', 'dragonfly'], ['puddle', 'wet', 'dragonfly', 'look', 'pad']),
    s('find-tall-flower', 'find', "Inch looks up the stem of a very tall sunflower with one fresh leaf at the top.", ['Inch'], ['sunflower', 'leaf'], ['tall', 'flower', 'leaf', 'top', 'up', 'look']),
    s('find-leaf-boat', 'find', "Spot sits on a leaf floating at the edge of the puddle.", ['Spot'], ['leaf', 'puddle'], ['leaf', 'float', 'boat', 'wet', 'sit']),
    s('find-crumb', 'find', "Spot finds a big crumb of cake on the ground beside the corner of a picnic blanket.", ['Spot'], ['cake crumb', 'picnic blanket'], ['crumb', 'cake', 'big', 'find', 'yum']),
    s('find-grass', 'find', "Buzz flies into a patch of grass much taller than he is.", ['Buzz'], ['tall grass'], ['grass', 'tall', 'fly', 'in', 'big']),
    s('prob-too-high', 'problem', "Inch stretches up from the bottom of the sunflower stem, and the leaf is far above him.", ['Inch'], ['sunflower', 'leaf'], ['high', 'up', 'stretch', 'can not', 'far']),
    s('prob-drift', 'problem', "The leaf floats out to the middle of the puddle with Spot sitting on it.", ['Spot'], ['leaf', 'puddle'], ['float', 'far', 'middle', 'wet', 'oh no']),
    s('prob-heavy', 'problem', "Spot pushes the big crumb with all her might, but it does not move.", ['Spot'], ['cake crumb'], ['push', 'heavy', 'big', 'can not', 'stuck']),
    s('prob-lost', 'problem', "Buzz is in the middle of the tall grass with blades all around him and no hive in sight.", ['Buzz'], ['tall grass'], ['lost', 'grass', 'where', 'home', 'tall']),
    s('try-climb', 'try', "Inch hugs the sunflower stem halfway up, and the leaf is still far above.", ['Inch'], ['sunflower', 'leaf'], ['climb', 'up', 'hug', 'try', 'stem']),
    s('try-paddle', 'try', "Spot paddles with a little twig on the side of the leaf.", ['Spot'], ['leaf', 'twig', 'puddle'], ['paddle', 'twig', 'row', 'try', 'wet']),
    s('try-pull-crumb', 'try', "Spot and Inch pull on the big crumb together, and it stays put.", ['Spot', 'Inch'], ['cake crumb'], ['pull', 'tug', 'try', 'heavy', 'crumb']),
    s('try-peek', 'try', "Buzz peeks between two blades of grass, and all he sees is more grass.", ['Buzz'], ['tall grass'], ['peek', 'look', 'grass', 'try', 'where']),
    s('help-buzz-leaf', 'help', "Buzz flies up to the top of the sunflower and holds the leaf in his arms. Inch watches nearby.", ['Buzz', 'Inch'], ['sunflower', 'leaf'], ['fly', 'up', 'leaf', 'help', 'get']),
    s('help-buzz-push', 'help', "Buzz flies behind the leaf boat and pushes it toward the edge of the puddle. Spot watches nearby.", ['Buzz', 'Spot'], ['leaf', 'puddle'], ['push', 'fly', 'help', 'edge', 'buzz']),
    s('help-ants', 'help', "A line of small ants marches up to help Spot with the big crumb.", ['Spot'], ['ants', 'cake crumb'], ['ants', 'help', 'line', 'march', 'lots']),
    s('help-spot-look', 'help', "Spot flies to the top of a tall flower and points her leg toward the beehive in the distance. Buzz watches nearby.", ['Spot', 'Buzz'], ['tall flower', 'beehive'], ['fly', 'up', 'point', 'see', 'help', 'that way']),
    s('solve-leaf-eat', 'solve', "Inch munches the fresh leaf, with little nibbled edges, and Buzz watches nearby.", ['Inch', 'Buzz'], ['leaf'], ['eat', 'munch', 'leaf', 'yum', 'nibble']),
    s('solve-shore', 'solve', "The leaf boat bumps the edge of the puddle and Spot steps onto dry land. Buzz watches nearby.", ['Spot', 'Buzz'], ['leaf', 'puddle'], ['land', 'step', 'dry', 'safe', 'did it']),
    s('solve-carry', 'solve', "Spot and the ants carry the big crumb along the path in a line.", ['Spot'], ['ants', 'cake crumb', 'path'], ['carry', 'together', 'crumb', 'ants', 'go']),
    s('solve-home', 'solve', "Buzz flies up to the round beehive hanging from its branch. Spot watches nearby.", ['Buzz', 'Spot'], ['beehive', 'branch'], ['home', 'hive', 'fly', 'yes', 'buzz']),
    s('cel-butterfly', 'celebrate', "A cocoon hanging from a twig opens and a new butterfly with big patterned wings and two short antennae climbs out, while Spot and Buzz watch.", ['Spot', 'Buzz'], ['cocoon', 'twig', 'butterfly'], ['butterfly', 'wings', 'wow', 'open', 'fly', 'yay']),
    s('cel-picnic', 'celebrate', "Spot, Buzz and the ants share the cake crumb on a leaf plate.", ['Spot', 'Buzz'], ['ants', 'cake crumb', 'leaf'], ['picnic', 'share', 'yum', 'cake', 'fun']),
    s('cel-dance', 'celebrate', "Spot, Buzz and Inch dance on top of a big flower.", ['Spot', 'Buzz', 'Inch'], ['big flower'], ['dance', 'spin', 'fun', 'yay', 'flower']),
    s('cel-hive', 'celebrate', "Buzz and other little bees dance in the air around the beehive.", ['Buzz'], ['beehive', 'bees'], ['dance', 'bees', 'buzz', 'home', 'yay']),
    s('rest-cocoon', 'rest', "A cocoon hangs from a twig with the caterpillar asleep inside, and Spot rests on a leaf beside it.", ['Spot'], ['cocoon', 'twig', 'leaf'], ['sleep', 'cocoon', 'rest', 'wait', 'shh']),
    s('rest-leaf-bed', 'rest', "Spot sleeps under a leaf blanket with a moon in the sky.", ['Spot'], ['leaf', 'moon'], ['sleep', 'leaf', 'bed', 'night', 'nap']),
    s('rest-flower-nap', 'rest', "Buzz naps curled up inside a big open flower.", ['Buzz'], ['flower'], ['nap', 'flower', 'sleep', 'rest', 'soft']),
    s('end-wave', 'ending', "Spot, Buzz and Inch wave goodbye toward the viewer from a leaf.", ['Spot', 'Buzz', 'Inch'], ['leaf'], ['bye', 'wave', 'friends', 'see you']),
    s('end-log', 'ending', "Spot flies home to a small round hole in a log and looks back toward the viewer.", ['Spot'], ['log'], ['home', 'log', 'fly', 'bye']),
    s('end-fireflies', 'ending', "Spot, Buzz and Inch sit on a leaf and watch little fireflies glow under the moon.", ['Spot', 'Buzz', 'Inch'], ['fireflies', 'moon', 'leaf'], ['night', 'glow', 'fireflies', 'moon', 'bye']),
  ],
  [
    path('butterfly', 'The Leaf at the Top', 'kindergarten', 'Inch cannot reach the leaf at the top of a sunflower until Buzz brings it down, and then Inch turns into a butterfly.',
      ['open-friends', 'exp-path', 'exp-flowers', 'find-tall-flower', 'prob-too-high', 'try-climb', 'help-buzz-leaf', 'solve-leaf-eat', 'rest-cocoon', 'cel-butterfly']),
    path('leaf-boat', 'The Leaf Boat', 'pre-k', 'Spot\'s leaf floats out into the puddle and Buzz pushes it back to the edge.',
      ['open-garden', 'exp-puddle', 'find-leaf-boat', 'prob-drift', 'try-paddle', 'help-buzz-push', 'solve-shore', 'rest-leaf-bed']),
    path('crumb', 'The Big Crumb', 'kindergarten', 'A cake crumb is too heavy for Spot until a line of ants comes to help carry it.',
      ['open-garden', 'exp-path', 'find-crumb', 'prob-heavy', 'try-pull-crumb', 'help-ants', 'solve-carry', 'cel-picnic', 'cel-dance', 'end-fireflies']),
    path('lost-buzz', 'Buzz in the Tall Grass', 'pre-k', 'Buzz gets lost in the tall grass and Spot flies up high to show him the way home.',
      ['open-hive', 'exp-flowers', 'find-grass', 'prob-lost', 'try-peek', 'help-spot-look', 'solve-home', 'cel-hive']),
  ]);

const castles = build('castles',
  'A castle with round towers and flags on a green hill, a courtyard, a big hall, a flower garden, a lily pond and a wooden bridge.',
  [
    { name: 'Flap', kind: 'dragon', pronoun: 'he', icon: 'dragon', describe: 'a small round friendly dragon with little bat-like wings, tiny smooth horns, a curly tail, a soft belly and no fire', words: ['Flap', 'dragon', 'little dragon', 'he', 'his'] },
    { name: 'Princess Plum', kind: 'princess', pronoun: 'she', icon: 'princess', describe: 'a young princess with a simple small crown, her hair in two round buns, and a long plain dress with puffy sleeves', words: ['Plum', 'Princess Plum', 'princess', 'she', 'her'] },
    { name: 'Sir Kip', kind: 'knight', pronoun: 'he', icon: 'shield', describe: 'a young knight in simple rounded armor, a helmet with a feather and the visor up so his smile shows, and a round shield with a star on it, with no sword', words: ['Kip', 'Sir Kip', 'knight', 'he', 'his'] },
  ],
  [
    s('open-castle', 'opening', "Flap stands at the castle gate on a green hill and waves toward the viewer, with flags on the towers.", ['Flap'], ['castle', 'gate', 'towers', 'flags'], ['castle', 'gate', 'hi', 'flags', 'big', 'dragon']),
    s('open-friends', 'opening', "Princess Plum, Sir Kip and Flap stand together in front of the castle, smiling toward the viewer.", ['Princess Plum', 'Sir Kip', 'Flap'], ['castle'], ['friends', 'castle', 'princess', 'knight', 'hi']),
    s('open-window', 'opening', "Princess Plum waves from a tower window, and Flap sits on the grass below.", ['Princess Plum', 'Flap'], ['tower', 'window'], ['tower', 'window', 'wave', 'hi', 'up', 'top']),
    s('exp-garden', 'explore', "Princess Plum and Flap walk through the castle garden past flower bushes and a fountain.", ['Princess Plum', 'Flap'], ['flower bushes', 'fountain'], ['garden', 'walk', 'flowers', 'fountain', 'fun']),
    s('exp-hall', 'explore', "Princess Plum, Sir Kip and Flap walk into a big hall with a long table and banners on the walls.", ['Princess Plum', 'Sir Kip', 'Flap'], ['hall', 'table', 'banners'], ['hall', 'big', 'table', 'walk', 'in']),
    s('exp-meadow', 'explore', "Flap chases butterflies in a meadow outside the castle walls.", ['Flap'], ['meadow', 'butterflies', 'castle walls'], ['run', 'hop', 'butterflies', 'meadow', 'fun']),
    s('find-pond', 'find', "Princess Plum kneels by the lily pond and looks at the fish, wearing her crown, with Flap beside her.", ['Princess Plum', 'Flap'], ['pond', 'lily pads', 'fish', 'crown'], ['pond', 'fish', 'crown', 'look', 'lily pad']),
    s('find-ball', 'find', "Princess Plum and Flap toss a ball back and forth in the castle courtyard.", ['Princess Plum', 'Flap'], ['ball', 'courtyard'], ['ball', 'toss', 'catch', 'play', 'fun']),
    s('find-gate-shut', 'find', "Flap comes back from the meadow and finds the castle gate shut, with Princess Plum and Sir Kip looking out through the bars.", ['Flap', 'Princess Plum', 'Sir Kip'], ['gate', 'bars', 'castle'], ['gate', 'shut', 'bars', 'out', 'in']),
    s('find-party', 'find', "Princess Plum stands at a small door of the hall holding a cake, and Flap looks at the door.", ['Princess Plum', 'Flap'], ['small door', 'cake'], ['party', 'cake', 'door', 'come in', 'small']),
    s('prob-crown-splash', 'problem', "Princess Plum's crown has fallen into the pond and floats on a lily pad far from the edge. Flap watches nearby.", ['Princess Plum', 'Flap'], ['crown', 'lily pad', 'pond'], ['crown', 'splash', 'pond', 'far', 'oh no', 'float']),
    s('prob-ball-tower', 'problem', "The ball sits stuck on the pointy roof at the top of the tall tower, and Princess Plum and Flap look up at it.", ['Princess Plum', 'Flap'], ['ball', 'tower', 'roof'], ['stuck', 'ball', 'top', 'high', 'tower', 'up']),
    s('prob-gate-stuck', 'problem', "Flap stands outside the shut castle gate and pushes the bars with both hands, but it will not move. Princess Plum and Sir Kip watch from inside, behind the bars.", ['Flap', 'Princess Plum', 'Sir Kip'], ['gate', 'bars'], ['stuck', 'push', 'gate', 'can not', 'shut', 'bars', 'inside', 'outside']),
    s('prob-too-big', 'problem', "Flap pokes his head through the small door, but his body and wings are too big to fit. Princess Plum watches nearby.", ['Flap', 'Princess Plum'], ['small door'], ['big', 'small', 'fit', 'can not', 'door']),
    s('try-crown-reach', 'try', "Princess Plum stretches her arm out over the pond from the edge, but the crown is too far. Flap watches nearby.", ['Princess Plum', 'Flap'], ['pond', 'crown', 'lily pad'], ['reach', 'far', 'arm', 'try', 'stretch']),
    s('try-stairs', 'try', "Sir Kip climbs the winding stairs inside the tower, and the top is still far up.", ['Sir Kip'], ['stairs', 'tower'], ['climb', 'stairs', 'up', 'try', 'steps']),
    s('try-gate-push', 'try', "Sir Kip and Princess Plum push the shut gate from the inside while Flap pushes the same gate from the outside, and it stays shut.", ['Sir Kip', 'Princess Plum', 'Flap'], ['gate'], ['push', 'gate', 'try', 'together', 'stuck']),
    s('try-squeeze', 'try', "Flap tucks in his wings and squeezes, but he still does not fit through the small door.", ['Flap'], ['small door'], ['squeeze', 'tuck', 'try', 'wings', 'small']),
    s('help-flap-crown', 'help', "Flap flies low over the pond and picks up the crown from the lily pad. Princess Plum watches nearby.", ['Flap', 'Princess Plum'], ['crown', 'pond', 'lily pad'], ['fly', 'wings', 'crown', 'help', 'pick up']),
    s('help-flap-ball', 'help', "Flap flies up to the top of the tower and grabs the ball from the roof.", ['Flap'], ['ball', 'tower', 'roof'], ['fly', 'up', 'grab', 'help', 'top']),
    s('help-kip-wheel', 'help', "Inside the castle, Sir Kip turns a big wooden wheel with a rope, and the barred gate starts to lift. Flap waits outside, past the gate.", ['Sir Kip', 'Flap'], ['wheel', 'rope', 'gate'], ['turn', 'wheel', 'rope', 'up', 'help', 'lift', 'inside', 'outside']),
    s('help-carry-table', 'help', "Princess Plum and Sir Kip carry the party table with the cake out into the garden.", ['Princess Plum', 'Sir Kip'], ['table', 'cake', 'garden'], ['carry', 'table', 'out', 'help', 'garden']),
    s('solve-crown-on', 'solve', "Princess Plum wears her crown again and smiles at Flap.", ['Princess Plum', 'Flap'], ['crown'], ['crown', 'on', 'back', 'yes', 'smile']),
    s('solve-ball-back', 'solve', "Flap drops the ball into Princess Plum's hands.", ['Flap', 'Princess Plum'], ['ball'], ['ball', 'catch', 'back', 'got it', 'drop']),
    s('solve-gate-up', 'solve', "The gate is up, and Flap walks into the castle to Princess Plum and Sir Kip.", ['Flap', 'Princess Plum', 'Sir Kip'], ['gate', 'castle'], ['open', 'in', 'gate', 'up', 'did it']),
    s('solve-party-garden', 'solve', "Flap sits at the party table in the garden with Princess Plum, Sir Kip and the cake.", ['Flap', 'Princess Plum', 'Sir Kip'], ['table', 'cake', 'garden'], ['party', 'sit', 'cake', 'garden', 'yes']),
    s('cel-dance', 'celebrate', "Princess Plum, Sir Kip and Flap dance together in the big hall.", ['Princess Plum', 'Sir Kip', 'Flap'], ['hall', 'banners'], ['dance', 'spin', 'fun', 'yay', 'hall']),
    s('cel-cake', 'celebrate', "Princess Plum, Sir Kip and Flap eat slices of cake topped with strawberries.", ['Princess Plum', 'Sir Kip', 'Flap'], ['cake', 'strawberries', 'plates'], ['cake', 'yum', 'eat', 'party', 'fun']),
    s('cel-parade', 'celebrate', "Princess Plum and Sir Kip march with little flags while Flap flies above them.", ['Princess Plum', 'Sir Kip', 'Flap'], ['flags'], ['march', 'flags', 'fly', 'parade', 'yay']),
    s('cel-crown-flap', 'celebrate', "Princess Plum puts a tiny crown on Flap's head.", ['Princess Plum', 'Flap'], ['tiny crown'], ['crown', 'little', 'yay', 'king', 'smile']),
    s('rest-tower-bed', 'rest', "Princess Plum sleeps in a bed by the tower window, with the moon outside.", ['Princess Plum'], ['bed', 'window', 'moon'], ['sleep', 'bed', 'night', 'moon', 'tower']),
    s('rest-flap-nap', 'rest', "Flap curls up asleep on a big soft rug with his tail around him.", ['Flap'], ['rug'], ['nap', 'sleep', 'rug', 'tail', 'rest']),
    s('rest-garden-nap', 'rest', "Sir Kip and Flap nap under a tree in the garden, with Sir Kip's shield leaning on the trunk.", ['Sir Kip', 'Flap'], ['tree', 'shield', 'garden'], ['nap', 'tree', 'shade', 'rest', 'sleep']),
    s('end-wave', 'ending', "Princess Plum, Sir Kip and Flap wave goodbye toward the viewer from the castle gate.", ['Princess Plum', 'Sir Kip', 'Flap'], ['gate', 'castle'], ['bye', 'wave', 'friends', 'see you']),
    s('end-carriage', 'ending', "Princess Plum and Sir Kip ride away down the hill in an open carriage pulled by a horse, and Flap flies beside it, all looking back toward the viewer.", ['Princess Plum', 'Sir Kip', 'Flap'], ['carriage', 'horse', 'hill', 'castle'], ['ride', 'carriage', 'horse', 'bye', 'go']),
    s('end-window-moon', 'ending', "Princess Plum waves good night from the tower window, with the moon and stars above the castle.", ['Princess Plum'], ['tower', 'window', 'moon', 'stars'], ['night', 'bye', 'moon', 'wave', 'good night']),
  ],
  [
    path('crown', 'The Crown in the Pond', 'pre-k', 'Princess Plum\'s crown falls into the pond and Flap flies down to get it.',
      ['open-friends', 'exp-garden', 'find-pond', 'prob-crown-splash', 'try-crown-reach', 'help-flap-crown', 'solve-crown-on', 'cel-crown-flap']),
    path('ball', 'The Ball on the Tower', 'kindergarten', 'A ball gets stuck on top of the tall tower and Flap flies up to grab it.',
      ['open-window', 'exp-hall', 'find-ball', 'prob-ball-tower', 'try-stairs', 'help-flap-ball', 'solve-ball-back', 'cel-dance', 'rest-flap-nap', 'end-wave']),
    path('gate', 'The Stuck Gate', 'pre-k', 'Flap is shut outside the castle until Sir Kip turns the big wheel to lift the gate.',
      ['open-castle', 'exp-meadow', 'find-gate-shut', 'prob-gate-stuck', 'try-gate-push', 'help-kip-wheel', 'solve-gate-up', 'end-wave']),
    path('party', 'Too Big for the Door', 'kindergarten', 'Flap is too big to fit through the door to the party, so his friends bring the party outside.',
      ['open-friends', 'exp-garden', 'find-party', 'prob-too-big', 'try-squeeze', 'help-carry-table', 'solve-party-garden', 'cel-cake', 'cel-parade', 'rest-garden-nap', 'end-window-moon']),
  ]);

const trains = build('trains',
  'Train tracks through green hills, over a stone bridge, past a farm, into a tunnel, and to a little station with a bench.',
  [
    { name: 'Toot', kind: 'little engine', pronoun: 'it', icon: 'engine', describe: 'a little steam engine with a tall round chimney, a round boiler, big front wheels, a small cab with plain windows, and no face', words: ['Toot', 'engine', 'train', 'little engine', 'it', 'its'] },
    { name: 'Chug', kind: 'big engine', pronoun: 'it', icon: 'engine', describe: 'a big strong engine with a long boxy body, a row of many wheels, a big headlight, plain windows, and no face', words: ['Chug', 'engine', 'train', 'big engine', 'it', 'its'] },
    { name: 'Peep', kind: 'bird', pronoun: 'she', describe: 'a small round bird with a short beak, a little tuft on her head and short wings', words: ['Peep', 'bird', 'little bird', 'she', 'her'] },
  ],
  [
    s('open-station', 'opening', "Toot waits at a little station with a bench and a round clock, and Peep sits on its cab roof.", ['Toot', 'Peep'], ['station', 'bench', 'clock'], ['station', 'train', 'wait', 'bench', 'hi', 'stop']),
    s('open-friends', 'opening', "Toot and Chug stand side by side on two tracks, with Peep sitting on Toot's cab roof.", ['Toot', 'Chug', 'Peep'], ['tracks'], ['friends', 'engines', 'tracks', 'big', 'little', 'hi']),
    s('open-shed', 'opening', "Toot rolls out of a wooden engine shed onto the tracks in the morning sun, with Peep on its roof.", ['Toot', 'Peep'], ['engine shed', 'tracks', 'sun'], ['out', 'go', 'sun', 'tracks', 'morning']),
    s('exp-hills', 'explore', "Toot pulls two train cars past green hills and round trees, with puffs of steam from its chimney. Peep rides on Toot's cab roof.", ['Toot', 'Peep'], ['train cars', 'hills', 'trees', 'steam'], ['hills', 'go', 'puff', 'steam', 'cars', 'chug']),
    s('exp-bridge', 'explore', "Toot crosses a stone bridge over a river. Peep rides on Toot's cab roof.", ['Toot', 'Peep'], ['stone bridge', 'river', 'tracks'], ['bridge', 'river', 'over', 'cross', 'water']),
    s('exp-farm', 'explore', "Toot pulls a flatcar piled with boxes past a farm, and cows by a fence watch it go by. Peep rides on Toot's cab roof.", ['Toot', 'Peep'], ['flatcar', 'boxes', 'farm', 'cows', 'fence'], ['farm', 'cows', 'boxes', 'go', 'look']),
    s('find-hill', 'find', "Toot, pulling two train cars, faces a steep hill where the track goes up and up. Peep rides on Toot's cab roof.", ['Toot', 'Peep'], ['steep hill', 'tracks', 'train cars'], ['hill', 'steep', 'up', 'big', 'tracks']),
    s('find-branch', 'find', "Toot rolls along the track, and a big branch lies across the track ahead. Peep rides on Toot's cab roof.", ['Toot', 'Peep'], ['branch', 'tracks', 'trees'], ['branch', 'track', 'ahead', 'look', 'big']),
    s('find-caboose-gone', 'find', "Toot pulls two train cars with no caboose at the end, and Peep looks back from the roof.", ['Toot', 'Peep'], ['train cars', 'tracks'], ['caboose', 'gone', 'look', 'back', 'where']),
    s('find-boxes', 'find', "Toot's flatcar at the station is piled very high with boxes. Peep rides on Toot's cab roof.", ['Toot', 'Peep'], ['flatcar', 'boxes', 'station'], ['boxes', 'pile', 'high', 'lots', 'big']),
    s('prob-slow-hill', 'problem', "Toot has stopped halfway up the steep hill with its two cars, puffing small puffs of steam. Peep rides on Toot's cab roof.", ['Toot', 'Peep'], ['steep hill', 'train cars', 'steam'], ['stop', 'steep', 'slow', 'puff', 'can not']),
    s('prob-branch', 'problem', "Toot has stopped in front of the big branch lying across the track. Peep rides on Toot's cab roof.", ['Toot', 'Peep'], ['branch', 'tracks'], ['stop', 'branch', 'block', 'track', 'oh no']),
    s('prob-caboose-far', 'problem', "The caboose sits alone on a side track far away by some trees.", [], ['caboose', 'side track', 'trees'], ['caboose', 'alone', 'far', 'track', 'lost']),
    s('prob-too-tall', 'problem', "Toot has stopped in front of a tunnel, and the pile of boxes on its flatcar is taller than the tunnel opening. Peep rides on Toot's cab roof.", ['Toot', 'Peep'], ['tunnel', 'flatcar', 'boxes'], ['tall', 'high', 'tunnel', 'stop', 'fit', 'can not']),
    s('try-hill-again', 'try', "Toot puffs big clouds of steam as it pushes up the hill, and Peep flaps her wings on the roof.", ['Toot', 'Peep'], ['steep hill', 'steam'], ['puff', 'try', 'push', 'chug', 'up', 'steam']),
    s('try-peep-tug', 'try', "Peep tugs on the big branch with her beak, and it does not move. Toot waits on the track behind her.", ['Peep', 'Toot'], ['branch', 'tracks'], ['tug', 'pull', 'beak', 'try', 'big']),
    s('try-back-up', 'try', "Toot rolls back along the track while Peep flies above, looking for the caboose.", ['Toot', 'Peep'], ['tracks', 'train cars'], ['back', 'look', 'roll', 'fly', 'try']),
    s('try-peep-box', 'try', "In front of the tunnel, Peep stands on the tall pile of boxes on Toot's flatcar and pushes the top box with her wings, but the pile is still too tall.", ['Peep', 'Toot'], ['boxes', 'flatcar', 'tunnel'], ['push', 'box', 'top', 'try', 'tall', 'tunnel']),
    s('help-chug-push', 'help', "Chug pushes Toot's train up the hill from behind. Peep rides on Toot's cab roof.", ['Chug', 'Toot', 'Peep'], ['steep hill', 'train cars'], ['push', 'help', 'big', 'strong', 'up']),
    s('help-chug-rope', 'help', "Chug pulls the big branch off the track with a rope. Toot waits on the track, and Peep rides on its cab roof.", ['Chug', 'Toot', 'Peep'], ['branch', 'rope', 'tracks'], ['pull', 'rope', 'help', 'branch', 'strong']),
    s('help-peep-finds', 'help', "Peep flies over the trees and spots the caboose on the side track.", ['Peep'], ['caboose', 'trees', 'side track'], ['fly', 'see', 'find', 'help', 'there']),
    s('help-chug-cars', 'help', "By the tunnel, Chug stands on the track beside Toot, and some of the boxes are now on Chug's flatcar, so both piles are low. Peep rides on Toot's cab roof.", ['Chug', 'Toot', 'Peep'], ['flatcar', 'boxes', 'tunnel'], ['help', 'share', 'boxes', 'some', 'two', 'low']),
    s('solve-top-hill', 'solve', "Toot and its two cars sit at the top of the hill, with Chug just behind. Peep rides on Toot's cab roof.", ['Toot', 'Chug', 'Peep'], ['hilltop', 'train cars'], ['top', 'did it', 'up', 'yes', 'hill']),
    s('solve-track-clear', 'solve', "The branch lies beside the track, and Toot rolls on past it. Peep rides on Toot's cab roof.", ['Toot', 'Peep'], ['branch', 'tracks'], ['go', 'clear', 'track', 'roll', 'yes']),
    s('solve-hook-caboose', 'solve', "The caboose is hooked back onto the end of Toot's train. Peep rides on Toot's cab roof.", ['Toot', 'Peep'], ['caboose', 'train cars'], ['caboose', 'back', 'hook', 'end', 'got it']),
    s('solve-tunnel', 'solve', "Toot and Chug come out of the other side of the tunnel, each with a smaller pile of boxes. Peep rides on Toot's cab roof.", ['Toot', 'Chug', 'Peep'], ['tunnel', 'boxes', 'flatcars'], ['out', 'tunnel', 'through', 'did it', 'fit']),
    s('cel-downhill', 'celebrate', "Toot rolls down the other side of the hill with steam puffs, and Peep holds her wings out wide.", ['Toot', 'Peep'], ['hill', 'steam', 'train cars'], ['down', 'fast', 'fun', 'wheee', 'roll']),
    s('cel-party', 'celebrate', "The station has strings of little flags and balloons, and the boxes are open to show toys and gifts. Toot and Chug wait on the tracks beside the station, and Peep sits on the station sign.", ['Toot', 'Chug', 'Peep'], ['station', 'flags', 'balloons', 'boxes', 'gifts'], ['party', 'gifts', 'balloons', 'flags', 'yay', 'fun']),
    s('cel-whistle', 'celebrate', "Toot blows its whistle with a puff of steam and sound lines, and Peep sings with little music notes.", ['Toot', 'Peep'], ['whistle', 'steam', 'music notes'], ['toot', 'whistle', 'sing', 'yay', 'fun']),
    s('rest-shed-night', 'rest', "Toot and Chug rest inside the engine shed at night, with the moon in the window.", ['Toot', 'Chug'], ['engine shed', 'moon', 'window'], ['night', 'rest', 'moon', 'shed', 'sleep']),
    s('rest-peep-nest', 'rest', "Peep sleeps in a little nest on the station roof.", ['Peep'], ['nest', 'station roof'], ['sleep', 'nest', 'roof', 'nap', 'shh']),
    s('rest-siding', 'rest', "Toot rests on a quiet track by a field as the first stars come out, and Peep sleeps on its roof.", ['Toot', 'Peep'], ['tracks', 'field', 'stars'], ['rest', 'stars', 'still', 'night', 'sleep']),
    s('end-wave', 'ending', "Peep waves a wing toward the viewer from Toot's cab roof.", ['Peep', 'Toot'], ['tracks'], ['bye', 'wave', 'wing', 'see you']),
    s('end-away', 'ending', "Toot and Chug ride away along the tracks into the hills.", ['Toot', 'Chug'], ['tracks', 'hills'], ['bye', 'go', 'away', 'tracks', 'hills']),
    s('end-station', 'ending', "Toot rolls back into the little station. Peep rides on Toot's cab roof.", ['Toot', 'Peep'], ['station', 'tracks'], ['home', 'station', 'back', 'stop', 'bye']),
  ],
  [
    path('hill', 'The Steep Hill', 'kindergarten', 'Toot cannot climb a steep hill until Chug pushes from behind.',
      ['open-station', 'exp-hills', 'exp-bridge', 'find-hill', 'prob-slow-hill', 'try-hill-again', 'help-chug-push', 'solve-top-hill', 'cel-downhill', 'rest-siding']),
    path('branch', 'The Branch on the Track', 'pre-k', 'A big branch blocks the track and Chug pulls it away with a rope.',
      ['open-shed', 'find-branch', 'prob-branch', 'try-peep-tug', 'help-chug-rope', 'solve-track-clear', 'cel-whistle', 'end-away']),
    path('caboose', 'The Lost Caboose', 'kindergarten', 'Toot\'s caboose is left behind on a side track and Peep flies up to find it.',
      ['open-friends', 'exp-bridge', 'find-caboose-gone', 'prob-caboose-far', 'try-back-up', 'help-peep-finds', 'solve-hook-caboose', 'cel-whistle', 'rest-shed-night', 'end-station']),
    path('boxes', 'Too Tall for the Tunnel', 'kindergarten', 'Toot\'s boxes are piled too high for the tunnel, so Chug carries some of them.',
      ['open-station', 'find-boxes', 'exp-farm', 'prob-too-tall', 'try-peep-box', 'help-chug-cars', 'solve-tunnel', 'cel-party', 'rest-peep-nest', 'end-wave']),
  ]);

const sports = build('sports',
  'A grassy ball field with a goal, a small baseball diamond, a basketball court, a running track and a bench.',
  [
    { name: 'Bop', kind: 'bear cub', pronoun: 'he', describe: 'a little bear cub with round ears, a plain striped team shirt with no logo and sneakers', words: ['Bop', 'bear', 'cub', 'bear cub', 'he', 'his'] },
    { name: 'Zig', kind: 'fox cub', pronoun: 'she', describe: 'a quick little fox cub with pointy ears, a fluffy tail with a pale tip, a plain team shirt with no logo and a sweatband', words: ['Zig', 'fox', 'fox cub', 'she', 'her'] },
    { name: 'Hoot', kind: 'owl coach', pronoun: 'he', describe: 'a round owl coach with big round eyes, a whistle on a string around his neck and a cap', words: ['Hoot', 'owl', 'coach', 'he', 'his'] },
  ],
  [
    s('open-field', 'opening', "Bop stands on a grassy ball field next to a goal and waves toward the viewer.", ['Bop'], ['field', 'goal'], ['field', 'goal', 'hi', 'fun', 'run']),
    s('open-team', 'opening', "Bop, Zig and Hoot stand together on the field, smiling toward the viewer, and Hoot holds his whistle.", ['Bop', 'Zig', 'Hoot'], ['field', 'whistle'], ['team', 'friends', 'coach', 'hi', 'three']),
    s('open-bag', 'opening', "Bop packs a sports bag with a ball and a water bottle.", ['Bop'], ['sports bag', 'ball', 'water bottle'], ['bag', 'pack', 'ball', 'water', 'get set']),
    s('exp-warmup', 'explore', "Bop and Zig stretch their arms up high on the grass while Hoot watches.", ['Bop', 'Zig', 'Hoot'], ['field'], ['stretch', 'up', 'warm up', 'arms', 'big']),
    s('exp-pass', 'explore', "Bop and Zig pass a soccer ball to each other on the field.", ['Bop', 'Zig'], ['soccer ball', 'field'], ['pass', 'kick', 'ball', 'run', 'fun']),
    s('exp-court', 'explore', "Bop and Zig walk onto a basketball court with a hoop at the end.", ['Bop', 'Zig'], ['basketball court', 'hoop'], ['court', 'hoop', 'walk', 'ball', 'big']),
    s('find-kick', 'find', "Bop kicks the soccer ball high into the air, and Zig watches it go up.", ['Bop', 'Zig'], ['soccer ball'], ['kick', 'up', 'high', 'ball', 'big']),
    s('find-tee', 'find', "A baseball sits on a tee, and Bop holds a bat ready.", ['Bop'], ['baseball', 'tee', 'bat'], ['bat', 'ball', 'tee', 'hit', 'ready']),
    s('find-race-day', 'find', "Bop sits at the edge of a running track with one sneaker on and one bare foot.", ['Bop'], ['running track', 'sneaker', 'flags'], ['race', 'track', 'sneaker', 'one', 'run']),
    s('find-hoop', 'find', "Bop holds a basketball and looks up at a tall hoop.", ['Bop'], ['basketball', 'hoop'], ['hoop', 'tall', 'ball', 'up', 'look']),
    s('prob-ball-tree', 'problem', "The soccer ball is stuck in the branches of a tree beside the field. Bop and Zig watch nearby.", ['Bop', 'Zig'], ['soccer ball', 'tree'], ['stuck', 'tree', 'ball', 'high', 'oh no']),
    s('prob-miss', 'problem', "Bop swings the bat over the top of the ball, and the ball still sits on the tee.", ['Bop'], ['bat', 'baseball', 'tee'], ['miss', 'swing', 'ball', 'tee', 'oops']),
    s('prob-sneaker-gone', 'problem', "Bop stands on the grass by the goal and looks into his open sports bag with a puzzled face. The bag is empty. He has one sneaker on and one bare foot.", ['Bop'], ['sports bag', 'sneaker', 'goal'], ['gone', 'sneaker', 'bag', 'where', 'oh no', 'empty', 'foot']),
    s('prob-short-shot', 'problem', "Bop's basketball falls short below the hoop.", ['Bop'], ['basketball', 'hoop'], ['short', 'miss', 'hoop', 'high', 'ball']),
    s('try-zig-jump', 'try', "Zig jumps up under the tree reaching for the ball, but it is too high. Bop watches nearby.", ['Zig', 'Bop'], ['tree', 'soccer ball'], ['jump', 'reach', 'up', 'try', 'high']),
    s('try-swing-again', 'try', "Bop swings again, and the ball wobbles on the tee.", ['Bop'], ['bat', 'baseball', 'tee'], ['swing', 'try', 'again', 'wobble', 'bat']),
    s('try-look-bench', 'try', "Bop and Zig look under a bench, and only a water bottle is there.", ['Bop', 'Zig'], ['bench', 'water bottle'], ['look', 'bench', 'under', 'where', 'try']),
    s('try-big-throw', 'try', "Bop throws the basketball with both arms, and it goes up but not in.", ['Bop'], ['basketball', 'hoop'], ['throw', 'up', 'try', 'ball', 'big']),
    s('help-hoot-fly', 'help', "Hoot flies up into the tree and nudges the soccer ball with his wing. Bop and Zig watch nearby.", ['Hoot', 'Bop', 'Zig'], ['tree', 'soccer ball'], ['fly', 'wing', 'nudge', 'help', 'up']),
    s('help-hoot-shows', 'help', "Hoot shows Bop how to hold the bat, with his eyes on the ball.", ['Hoot', 'Bop'], ['bat', 'baseball', 'tee'], ['show', 'hold', 'help', 'coach', 'eyes']),
    s('help-zig-finds', 'help', "Zig finds the sneaker in the tall grass by the fence and holds it up. Bop watches nearby.", ['Zig', 'Bop'], ['sneaker', 'grass', 'fence'], ['find', 'sneaker', 'grass', 'help', 'here']),
    s('help-hoot-lower', 'help', "Hoot turns a crank on the hoop pole, and the hoop moves down lower. Bop watches nearby.", ['Hoot', 'Bop'], ['hoop', 'crank', 'pole'], ['crank', 'turn', 'down', 'help', 'lower']),
    s('solve-ball-down', 'solve', "Under the tree, Bop holds the one soccer ball he just caught, and Zig and Hoot smile beside him.", ['Bop', 'Zig', 'Hoot'], ['soccer ball', 'tree'], ['catch', 'down', 'got it', 'ball', 'hold']),
    s('solve-hit', 'solve', "Bop hits the ball off the tee and it flies away over the field. Hoot watches nearby.", ['Bop', 'Hoot'], ['bat', 'baseball', 'tee'], ['hit', 'bat', 'fly', 'yes', 'pop']),
    s('solve-sneaker-on', 'solve', "Bop pulls the sneaker onto his foot and Zig gives a thumbs up.", ['Bop', 'Zig'], ['sneaker'], ['on', 'sneaker', 'ready', 'yes', 'foot']),
    s('solve-swish', 'solve', "Bop's basketball drops through the net of the hoop. Hoot watches nearby.", ['Bop', 'Hoot'], ['basketball', 'hoop', 'net'], ['in', 'swish', 'net', 'yes', 'shot']),
    s('cel-goal', 'celebrate', "Bop kicks the soccer ball into the goal net while Zig cheers with her arms up.", ['Bop', 'Zig'], ['soccer ball', 'goal', 'net'], ['goal', 'kick', 'net', 'cheer', 'yay']),
    s('cel-run-bases', 'celebrate', "Bop runs to a base on the diamond while Zig and Hoot cheer.", ['Bop', 'Zig', 'Hoot'], ['base', 'diamond'], ['run', 'base', 'fast', 'cheer', 'go']),
    s('cel-medals', 'celebrate', "Bop and Zig stand on little blocks wearing medals, and Hoot claps.", ['Bop', 'Zig', 'Hoot'], ['medals', 'blocks'], ['medal', 'win', 'clap', 'yay', 'top']),
    s('cel-high-five', 'celebrate', "Bop and Zig give each other a high five, and Hoot claps his wings.", ['Bop', 'Zig', 'Hoot'], ['field'], ['high five', 'slap', 'clap', 'team', 'yay']),
    s('rest-water', 'rest', "Bop and Zig sit on a bench and drink from water bottles.", ['Bop', 'Zig'], ['bench', 'water bottles'], ['rest', 'sip', 'water', 'sit', 'bench']),
    s('rest-shade-nap', 'rest', "Bop naps under a shady tree with a ball for a pillow.", ['Bop'], ['tree', 'ball'], ['nap', 'shade', 'tree', 'rest', 'sleep']),
    s('rest-night', 'rest', "Bop sleeps in bed with a trophy on the shelf and a moon in the window.", ['Bop'], ['bed', 'trophy', 'shelf', 'moon'], ['sleep', 'bed', 'night', 'trophy', 'moon']),
    s('end-wave', 'ending', "Bop, Zig and Hoot wave goodbye toward the viewer from the field.", ['Bop', 'Zig', 'Hoot'], ['field'], ['bye', 'wave', 'team', 'see you']),
    s('end-walk-home', 'ending', "Bop and Zig walk home with the sports bag and a ball.", ['Bop', 'Zig'], ['sports bag', 'ball', 'path'], ['home', 'walk', 'bag', 'bye']),
    s('end-team-hug', 'ending', "Bop, Zig and Hoot have a big team hug.", ['Bop', 'Zig', 'Hoot'], ['field'], ['hug', 'team', 'friends', 'happy']),
  ],
  [
    path('tree', 'The Ball in the Tree', 'pre-k', 'The soccer ball gets stuck in a tree and Coach Hoot flies up to nudge it down.',
      ['open-team', 'exp-pass', 'find-kick', 'prob-ball-tree', 'try-zig-jump', 'help-hoot-fly', 'solve-ball-down', 'cel-goal']),
    path('tee', 'Bop Can Hit', 'kindergarten', 'Bop keeps missing the ball on the tee until Hoot shows him how to hold the bat.',
      ['open-field', 'exp-warmup', 'find-tee', 'prob-miss', 'try-swing-again', 'help-hoot-shows', 'solve-hit', 'cel-run-bases', 'rest-water', 'end-team-hug']),
    path('sneaker', 'The Lost Sneaker', 'kindergarten', 'Bop cannot find his sneaker on race day until Zig spots it in the grass.',
      ['open-bag', 'exp-warmup', 'find-race-day', 'prob-sneaker-gone', 'try-look-bench', 'help-zig-finds', 'solve-sneaker-on', 'cel-medals', 'cel-high-five', 'rest-water']),
    path('hoop', 'The Tall Hoop', 'pre-k', 'The hoop is too high for Bop until Hoot lowers it.',
      ['open-team', 'exp-court', 'find-hoop', 'prob-short-shot', 'try-big-throw', 'help-hoot-lower', 'solve-swish', 'end-walk-home']),
  ]);

const pets = build('pets',
  'A cozy house with a living room, a couch, a rug, a bookshelf, a kitchen and a backyard with a fence and a tree.',
  [
    { name: 'Wag', kind: 'puppy', pronoun: 'he', icon: 'puppy', describe: 'a fluffy little puppy with one floppy ear and one ear up, a wagging tail and a collar with a round tag', words: ['Wag', 'puppy', 'pup', 'dog', 'he', 'his'] },
    { name: 'Mitt', kind: 'kitten', pronoun: 'she', icon: 'kitten', describe: 'a small kitten with white paws, a striped tail, pointy ears and long whiskers', words: ['Mitt', 'kitten', 'cat', 'kitty', 'she', 'her'] },
    { name: 'Nibs', kind: 'hamster', pronoun: 'he', icon: 'hamster', describe: 'a round little hamster with chubby cheeks, tiny round ears and tiny paws', words: ['Nibs', 'hamster', 'he', 'his'] },
  ],
  [
    s('open-house', 'opening', "Wag sits by the front door of a cozy house, wagging his tail toward the viewer.", ['Wag'], ['house', 'door'], ['dog', 'door', 'home', 'hi', 'wag']),
    s('open-friends', 'opening', "Wag and Mitt sit on a rug, and Nibs sits in his cage on a low table behind them, all smiling toward the viewer.", ['Wag', 'Mitt', 'Nibs'], ['rug', 'cage', 'table'], ['pets', 'friends', 'rug', 'cage', 'hi']),
    s('open-wake', 'opening', "Wag wakes up in a round dog bed and stretches his front legs.", ['Wag'], ['dog bed'], ['wake', 'up', 'bed', 'stretch', 'yawn']),
    s('exp-yard', 'explore', "Wag runs across the backyard by the fence and the tree.", ['Wag'], ['yard', 'fence', 'tree'], ['run', 'yard', 'fun', 'grass', 'go']),
    s('exp-yarn', 'explore', "Mitt bats a ball of yarn across the floor, and the yarn unrolls behind it.", ['Mitt'], ['ball of yarn'], ['yarn', 'bat', 'roll', 'play', 'cat']),
    s('exp-window', 'explore', "Mitt and Wag look out of a window at birds on a branch.", ['Mitt', 'Wag'], ['window', 'birds', 'branch'], ['window', 'birds', 'look', 'see', 'out']),
    s('find-ball', 'find', "Wag plays with a red ball on the living room rug near the couch.", ['Wag'], ['ball', 'rug', 'couch'], ['ball', 'play', 'red', 'rug', 'fun']),
    s('find-shelf', 'find', "Mitt climbs up the bookshelf from shelf to shelf.", ['Mitt'], ['bookshelf', 'books'], ['climb', 'up', 'shelf', 'books', 'cat']),
    s('find-cage-open', 'find', "The door of the hamster cage is open and the little wheel inside is empty.", [], ['cage', 'wheel', 'open door'], ['cage', 'open', 'empty', 'wheel', 'door']),
    s('find-mud', 'find', "Wag finds a mud puddle in the backyard and steps in with his front paws.", ['Wag'], ['mud puddle', 'yard'], ['mud', 'puddle', 'step', 'wet', 'paws']),
    s('prob-ball-couch', 'problem', "The red ball rolls far under the couch, and Wag puts his nose to the gap.", ['Wag'], ['ball', 'couch'], ['under', 'couch', 'ball', 'gone', 'oh no']),
    s('prob-mitt-high', 'problem', "Mitt sits on top of the tall bookshelf and looks down at the floor far below.", ['Mitt'], ['bookshelf'], ['high', 'top', 'down', 'stuck', 'can not']),
    s('prob-nibs-gone', 'problem', "Wag and Mitt look into the empty hamster cage with the door open.", ['Wag', 'Mitt'], ['cage', 'wheel'], ['gone', 'where', 'cage', 'empty', 'oh no']),
    s('prob-muddy', 'problem', "Wag is covered in mud, and muddy paw prints go across the kitchen floor.", ['Wag'], ['mud', 'paw prints', 'kitchen floor'], ['mud', 'muddy', 'paws', 'prints', 'oops']),
    s('try-paw', 'try', "Wag reaches one paw under the couch, but the ball is too far.", ['Wag'], ['couch'], ['paw', 'reach', 'under', 'try', 'far']),
    s('try-mitt-reach', 'try', "Mitt reaches one paw down toward the shelf below, but it is too far.", ['Mitt'], ['bookshelf'], ['reach', 'paw', 'down', 'try', 'far']),
    s('try-look-room', 'try', "Wag sniffs behind a plant pot and Mitt peeks behind a chair.", ['Wag', 'Mitt'], ['plant pot', 'chair'], ['sniff', 'look', 'peek', 'where', 'try']),
    s('try-wipe', 'try', "Wag wipes his muddy paws on the doormat, and he is still muddy.", ['Wag'], ['doormat', 'mud'], ['wipe', 'mat', 'paws', 'mud', 'try']),
    s('help-mitt-under', 'help', "Mitt crawls under the couch, and only her striped tail sticks out. Wag watches nearby.", ['Mitt', 'Wag'], ['couch'], ['crawl', 'under', 'tail', 'help', 'small']),
    s('help-wag-pillows', 'help', "Wag pushes a big soft cushion and a box under the bookshelf like steps. Mitt watches nearby.", ['Wag', 'Mitt'], ['cushion', 'box', 'bookshelf'], ['push', 'steps', 'box', 'help', 'soft']),
    s('help-mitt-listen', 'help', "Mitt listens with her ears up next to a fuzzy slipper on the floor. Wag watches nearby.", ['Mitt', 'Wag'], ['slipper'], ['listen', 'ears', 'hear', 'help', 'slipper']),
    s('help-tub', 'help', "Wag sits in a bathtub full of bubbles, and Mitt pulls a fluffy towel over to the tub.", ['Mitt', 'Wag'], ['bathtub', 'bubbles', 'towel'], ['tub', 'bath', 'bubbles', 'help', 'towel', 'in']),
    s('solve-ball-out', 'solve', "Mitt pushes the red ball out from under the couch to Wag.", ['Mitt', 'Wag'], ['ball', 'couch'], ['push', 'out', 'ball', 'got it', 'yes']),
    s('solve-mitt-down', 'solve', "Mitt hops down onto the box and then onto the soft cushion. Wag watches nearby.", ['Mitt', 'Wag'], ['box', 'cushion', 'bookshelf'], ['hop', 'down', 'safe', 'did it', 'soft']),
    s('solve-nibs-found', 'solve', "Nibs peeks out of the fuzzy slipper with full chubby cheeks. Mitt and Wag watch nearby.", ['Nibs', 'Mitt', 'Wag'], ['slipper'], ['found', 'peek', 'there', 'cheeks', 'yes']),
    s('solve-clean', 'solve', "Wag sits in the bubbly bathtub, all clean, with bubbles on his head. Mitt watches nearby.", ['Wag', 'Mitt'], ['bathtub', 'bubbles'], ['clean', 'bath', 'bubbles', 'wet', 'tub', 'scrub']),
    s('cel-fetch', 'celebrate', "Wag jumps and catches the red ball in the backyard. Mitt watches nearby.", ['Wag', 'Mitt'], ['ball', 'yard'], ['catch', 'jump', 'fetch', 'fun', 'yay']),
    s('cel-chase', 'celebrate', "Wag and Mitt play chase around the rug.", ['Wag', 'Mitt'], ['rug'], ['chase', 'run', 'play', 'fun', 'tag']),
    s('cel-wheel', 'celebrate', "Nibs runs on the wheel in his cage while Wag and Mitt watch.", ['Nibs', 'Wag', 'Mitt'], ['cage', 'wheel'], ['run', 'wheel', 'spin', 'fun', 'yay']),
    s('cel-towel', 'celebrate', "Wag is wrapped in a fluffy towel, and Mitt sits beside him.", ['Wag', 'Mitt'], ['towel'], ['towel', 'dry', 'soft', 'clean', 'yay']),
    s('rest-pile-nap', 'rest', "Wag and Mitt nap curled up together in the round dog bed.", ['Wag', 'Mitt'], ['dog bed'], ['nap', 'sleep', 'bed', 'cozy', 'rest']),
    s('rest-nibs-sleep', 'rest', "Nibs sleeps curled up in soft bedding in his cage.", ['Nibs'], ['cage', 'bedding'], ['sleep', 'nap', 'cage', 'shh', 'soft']),
    s('rest-moon-window', 'rest', "Wag sleeps by the window with the moon outside.", ['Wag'], ['window', 'moon'], ['sleep', 'night', 'moon', 'window', 'rest']),
    s('end-wave', 'ending', "Wag, Mitt and Nibs wave goodbye toward the viewer, with Nibs sitting on top of his cage.", ['Wag', 'Mitt', 'Nibs'], ['cage', 'rug'], ['bye', 'wave', 'pets', 'see you']),
    s('end-door', 'ending', "Wag waits by the front door with his leash in his mouth.", ['Wag'], ['door', 'leash'], ['leash', 'door', 'walk', 'go', 'bye']),
    s('end-hug', 'ending', "Wag and Mitt cuddle on the rug, with Nibs sitting on top of Wag's back.", ['Wag', 'Mitt', 'Nibs'], ['rug'], ['hug', 'cuddle', 'friends', 'love']),
  ],
  [
    path('ball', 'The Ball Under the Couch', 'pre-k', 'Wag\'s ball rolls under the couch and little Mitt crawls under to get it.',
      ['open-friends', 'find-ball', 'prob-ball-couch', 'try-paw', 'help-mitt-under', 'solve-ball-out', 'cel-fetch', 'rest-pile-nap']),
    path('shelf', 'Mitt Up High', 'kindergarten', 'Mitt climbs too high on the bookshelf and Wag builds her soft steps to get down.',
      ['open-wake', 'exp-window', 'find-shelf', 'prob-mitt-high', 'try-mitt-reach', 'help-wag-pillows', 'solve-mitt-down', 'cel-chase', 'rest-moon-window', 'end-hug']),
    path('nibs', 'Where Is Nibs?', 'kindergarten', 'Nibs gets out of his cage and Mitt hears him hiding in a slipper.',
      ['open-friends', 'exp-yarn', 'find-cage-open', 'prob-nibs-gone', 'try-look-room', 'help-mitt-listen', 'solve-nibs-found', 'cel-wheel', 'rest-nibs-sleep', 'end-wave']),
    path('mud', 'Muddy Wag', 'pre-k', 'Wag gets muddy in the yard and a bubble bath makes him clean.',
      ['open-house', 'exp-yard', 'find-mud', 'prob-muddy', 'try-wipe', 'help-tub', 'solve-clean', 'cel-towel']),
  ]);

const jungle = build('jungle',
  'A green jungle with tall trees, hanging vines, big leaves, bright flowers, a calm river and a sunny clearing.',
  [
    { name: 'Zip', kind: 'monkey', pronoun: 'he', icon: 'monkey', describe: 'a little monkey with round ears, a round face, long arms and a long curly tail', words: ['Zip', 'monkey', 'little monkey', 'he', 'his'] },
    { name: 'Bim', kind: 'baby elephant', pronoun: 'she', icon: 'elephant', describe: 'a baby elephant with big floppy ears, a short curly trunk and round feet', words: ['Bim', 'elephant', 'baby elephant', 'she', 'her'] },
    { name: 'Mango', kind: 'parrot', pronoun: 'he', icon: 'parrot', describe: 'a small parrot with a curved beak, a feather crest on his head and long tail feathers', words: ['Mango', 'parrot', 'bird', 'he', 'his'] },
  ],
  [
    s('open-tree', 'opening', "Zip hangs by his curly tail from a branch and waves toward the viewer.", ['Zip'], ['branch', 'tree', 'leaves'], ['hang', 'tail', 'tree', 'hi', 'wave', 'monkey']),
    s('open-friends', 'opening', "Zip, Bim and Mango stand by a big jungle tree with vines, and Mango sits on Bim's head, all smiling toward the viewer.", ['Zip', 'Bim', 'Mango'], ['tree', 'vines'], ['friends', 'jungle', 'tree', 'three', 'hi']),
    s('open-wake', 'opening', "Mango sits in a nest in a hollow of a tree as the sun comes up.", ['Mango'], ['nest', 'tree', 'sun'], ['nest', 'sun', 'up', 'wake', 'bird', 'morning']),
    s('exp-vines', 'explore', "Zip swings on a vine between two trees while Mango flies beside him.", ['Zip', 'Mango'], ['vine', 'trees'], ['swing', 'vine', 'fly', 'zip', 'fun']),
    s('exp-river', 'explore', "Bim and Zip walk by a calm river, and a hippo rests in the water with only its eyes and ears showing.", ['Bim', 'Zip'], ['river', 'hippo', 'big leaves'], ['river', 'walk', 'hippo', 'water', 'look']),
    s('exp-path', 'explore', "Bim walks along a jungle path past big leaves and flowers, with Zip riding on her back.", ['Bim', 'Zip'], ['path', 'big leaves', 'flowers'], ['walk', 'ride', 'path', 'leaves', 'go']),
    s('find-bananas', 'find', "Bim and Zip look up at a bunch of bananas high in a tall tree.", ['Bim', 'Zip'], ['bananas', 'tall tree'], ['bananas', 'tree', 'up', 'yum', 'look']),
    s('find-ball', 'find', "Zip and Bim kick a round ball back and forth by the river.", ['Zip', 'Bim'], ['ball', 'river'], ['ball', 'kick', 'play', 'fun', 'river']),
    s('find-hot', 'find', "Bim stands in a sunny clearing with no trees, under a big round sun.", ['Bim'], ['sun', 'clearing'], ['sun', 'hot', 'big', 'no shade']),
    s('find-hide', 'find', "Bim covers her eyes with her big ears to count, and Zip tiptoes away.", ['Bim', 'Zip'], ['big leaves'], ['hide', 'seek', 'count', 'eyes', 'game']),
    s('prob-too-high', 'problem', "Bim stretches her trunk up under the tall tree, but the bananas are far above.", ['Bim'], ['bananas', 'tall tree'], ['high', 'up', 'trunk', 'reach', 'can not']),
    s('prob-ball-river', 'problem', "The ball floats in the middle of the river, and Zip and Bim look at it from the bank.", ['Zip', 'Bim'], ['ball', 'river'], ['float', 'river', 'ball', 'far', 'oh no']),
    s('prob-too-hot', 'problem', "Bim stands in the hot sun with droopy ears and a droopy trunk.", ['Bim'], ['sun'], ['hot', 'sun', 'droop', 'tired', 'too hot']),
    s('prob-cant-find', 'problem', "Bim looks around big leaves and tree trunks, and nobody is in sight.", ['Bim'], ['big leaves', 'tree trunks'], ['look', 'where', 'can not', 'find', 'hide']),
    s('try-bim-hop', 'try', "Bim hops on her back legs reaching with her trunk, but the bananas are still too high.", ['Bim'], ['bananas', 'tall tree'], ['hop', 'jump', 'try', 'trunk', 'up']),
    s('try-stick', 'try', "Zip reaches out over the river with a long stick from the bank, but the stick is too short. Bim watches nearby.", ['Zip', 'Bim'], ['stick', 'river', 'ball'], ['stick', 'reach', 'try', 'short', 'far']),
    s('try-fan', 'try', "Bim fans herself with her big ears in the hot sun.", ['Bim'], ['sun'], ['fan', 'ears', 'flap', 'try', 'hot']),
    s('try-look-log', 'try', "Bim looks into a hollow log, and only a little frog is inside.", ['Bim'], ['hollow log', 'frog'], ['look', 'log', 'frog', 'not here', 'peek']),
    s('help-zip-climb', 'help', "Zip climbs up the tall tree toward the bananas, using his hands, feet and tail. Bim watches nearby.", ['Zip', 'Bim'], ['tall tree', 'bananas'], ['climb', 'up', 'tree', 'help', 'tail']),
    s('help-bim-wade', 'help', "Bim wades into the shallow river and reaches for the ball with her trunk. Zip watches nearby.", ['Bim', 'Zip'], ['river', 'ball'], ['wade', 'trunk', 'reach', 'help', 'wet']),
    s('help-zip-leaf', 'help', "Zip holds a big leaf over Bim like an umbrella, and they walk toward the trees.", ['Zip', 'Bim'], ['big leaf', 'sun'], ['leaf', 'shade', 'help', 'walk', 'big']),
    s('help-mango-points', 'help', "Mango flies down and points a wing at a big bush. Bim watches nearby.", ['Mango', 'Bim'], ['bush', 'big leaves'], ['point', 'wing', 'look', 'there', 'help']),
    s('solve-bananas', 'solve', "Zip drops the bunch of bananas down from the tree, and Bim catches it with her trunk.", ['Zip', 'Bim'], ['bananas', 'tall tree'], ['catch', 'drop', 'bananas', 'got it', 'yum']),
    s('solve-ball-back', 'solve', "Bim lifts the ball out of the water with her trunk, and Zip cheers on the bank.", ['Bim', 'Zip'], ['ball', 'river'], ['lift', 'trunk', 'ball', 'got it', 'yes']),
    s('solve-cool', 'solve', "At the river, Bim sprays cool water from her trunk over herself and Zip.", ['Bim', 'Zip'], ['river', 'water spray'], ['spray', 'cool', 'wet', 'water', 'ah', 'yes']),
    s('solve-found-zip', 'solve', "Zip pops out of the big bush with a big grin, and Bim smiles. Mango watches nearby.", ['Zip', 'Bim', 'Mango'], ['bush'], ['found', 'pop', 'there you are', 'yes', 'hide']),
    s('cel-bananas', 'celebrate', "Zip, Bim and Mango sit together and eat bananas.", ['Zip', 'Bim', 'Mango'], ['bananas', 'banana peels'], ['eat', 'bananas', 'yum', 'share', 'munch']),
    s('cel-splash', 'celebrate', "Bim and Zip splash and play together in the shallow river.", ['Bim', 'Zip'], ['river', 'splashes'], ['splash', 'wet', 'play', 'fun', 'yay']),
    s('cel-dance', 'celebrate', "Zip and Bim dance while Mango sings, with little music notes around him.", ['Zip', 'Bim', 'Mango'], ['music notes', 'flowers'], ['dance', 'sing', 'fun', 'yay', 'hop']),
    s('cel-swing', 'celebrate', "Zip swings high on a vine while Bim and Mango cheer.", ['Zip', 'Bim', 'Mango'], ['vine', 'trees'], ['swing', 'high', 'cheer', 'fun', 'wheee']),
    s('rest-hammock', 'rest', "Zip naps in a hammock made of big leaves tied between two branches.", ['Zip'], ['leaf hammock', 'branches'], ['nap', 'hammock', 'sleep', 'rest', 'swing']),
    s('rest-moon', 'rest', "Zip, Bim and Mango sleep under a big tree with the moon and stars above.", ['Zip', 'Bim', 'Mango'], ['tree', 'moon', 'stars'], ['sleep', 'night', 'moon', 'stars', 'shh']),
    s('rest-bim-nap', 'rest', "Bim naps in the shade of a big tree with her ears folded over her. Zip naps curled up beside her.", ['Bim', 'Zip'], ['tree', 'shade'], ['nap', 'shade', 'cool', 'rest', 'sleep']),
    s('end-wave', 'ending', "Zip, Bim and Mango wave goodbye toward the viewer.", ['Zip', 'Bim', 'Mango'], ['tree', 'vines'], ['bye', 'wave', 'friends', 'see you']),
    s('end-walk-home', 'ending', "Bim walks home along the jungle path with Zip and Mango riding on her back.", ['Bim', 'Zip', 'Mango'], ['path', 'big leaves'], ['home', 'walk', 'ride', 'bye']),
    s('end-hug', 'ending', "Zip hugs Bim's trunk, and Mango sits on Bim's head.", ['Zip', 'Bim', 'Mango'], ['tree'], ['hug', 'trunk', 'friends', 'love']),
  ],
  [
    path('bananas', 'Bananas Up High', 'pre-k', 'The bananas are too high for Bim until Zip climbs up and drops them down.',
      ['open-friends', 'exp-path', 'find-bananas', 'prob-too-high', 'try-bim-hop', 'help-zip-climb', 'solve-bananas', 'cel-bananas']),
    path('ball', 'The Ball in the River', 'kindergarten', 'The ball floats out into the river and Bim wades in to get it with her trunk.',
      ['open-tree', 'exp-river', 'find-ball', 'prob-ball-river', 'try-stick', 'help-bim-wade', 'solve-ball-back', 'cel-splash', 'rest-hammock', 'end-wave']),
    path('hot', 'A Hot Day', 'pre-k', 'Bim is too hot in the sun until Zip shades her with a leaf and they cool off at the river.',
      ['open-friends', 'find-hot', 'prob-too-hot', 'try-fan', 'help-zip-leaf', 'solve-cool', 'rest-bim-nap', 'end-hug']),
    path('hide', 'Hide and Seek', 'kindergarten', 'Bim cannot find Zip in a game of hide and seek until Mango points the way.',
      ['open-tree', 'exp-vines', 'find-hide', 'prob-cant-find', 'try-look-log', 'help-mango-points', 'solve-found-zip', 'cel-dance', 'cel-swing', 'rest-moon', 'end-walk-home']),
  ]);

export const SCENES: Record<ThemeId, ThemeScenes> = {
  dinosaurs, trucks, unicorns, ocean, space, farm, bugs, castles, trains, sports, pets, jungle,
};

export const scenesFor = (theme: ThemeId): ThemeScenes => SCENES[theme];
export const sceneById = (theme: ThemeId, id: string): Scene | undefined => SCENES[theme].scenes.find((sc) => sc.id === id);
/** Where the art agent saves each scene picture (under public/). */
export const sceneSrc = (theme: ThemeId, id: string): string => `/program/scenes/${theme}/${id}.png`;
/** The ready-made story paths that fit a book size. */
export const pathsFor = (theme: ThemeId, level: Level): StoryPath[] => SCENES[theme].paths.filter((p) => p.level === level);
