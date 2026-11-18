// The Christmas picture books for the personalized storybook (src/lib/storybook/). Same rules as the program's
// scene library (src/lib/program/scenes.ts): every page's words are true of its picture, the cast looks the same in
// every drawing, and the child is never drawn. {{name}} is a friend who only talks, spots, points, claps or cheers.
// Art: public/storybook/christmas/<id>.png (2400x1800, 1-bit), drawn from `drawPrompt`.
// Not a program theme: the program's interest grid, plans and AI never see it.
import { SCENE_STYLE } from '../program/scenes';

export interface BookCast { name: string; kind: string; describe: string }
export interface BookScene { id: string; shows: string; cast: string[]; drawPrompt: string }

export const CHRISTMAS_SETTING = 'A snowy hill with one big pine tree, a little log cabin with a wreath on the door, a wooden sled and falling snowflakes.';

export const CHRISTMAS_CAST: BookCast[] = [
  { name: 'Pip', kind: 'reindeer', describe: 'a small friendly young reindeer with short branching antlers, big round eyes, a round nose, a fluffy chest and a thin collar with one round bell' },
  { name: 'Flake', kind: 'snowman', describe: 'a friendly snowman made of three round snowballs stacked up, dot eyes, a carrot nose, a knit hat with a pom-pom on top, a striped scarf, round buttons and two thin stick arms' },
  { name: 'Snug', kind: 'polar bear cub', describe: 'a small round polar bear cub with fluffy fur, small round ears, big round eyes and a little round nose' },
];

const D = (id: string, shows: string, cast: string[]): BookScene => {
  const who = cast.map((n) => `${n} is ${CHRISTMAS_CAST.find((c) => c.name === n)!.describe}.`).join(' ');
  return { id, shows, cast, drawPrompt: `${SCENE_STYLE} Snowy winter setting. Scene: ${shows}${who ? ` Characters: ${who}` : ''}` };
};

export const CHRISTMAS_SCENES: BookScene[] = [
  D('open-friends', 'Pip, Flake and Snug stand together in the snow beside a big pine tree and smile toward the viewer, with snowflakes falling.', ['Pip', 'Flake', 'Snug']),
  D('open-cabin', 'Flake stands in the snow in front of a little log cabin with a round wreath on the door and waves one stick arm toward the viewer.', ['Flake']),
  D('exp-sled', 'Pip and Snug ride a wooden sled down a snowy hill together, smiling, with snow spraying up behind the sled.', ['Pip', 'Snug']),
  D('find-star', 'Snug sits in the snow under a big pine tree and holds up a big five-pointed star in both paws, smiling at it.', ['Snug']),
  D('prob-star-falls', 'Snug sits beside a deep pile of snow and looks down at a small round hole in the top of the pile, with a round surprised mouth and empty paws.', ['Snug']),
  D('try-dig', 'Snug digs into a big pile of snow with both front paws, and clumps of snow fly up into the air behind him.', ['Snug']),
  D('help-pip-nose', 'Pip pushes her nose into a pile of snow, and one point of a big five-pointed star pokes up out of the snow right next to her nose.', ['Pip']),
  D('solve-star-top', 'Pip stretches her neck up tall beside a big pine tree and sets a big five-pointed star on the very top of the tree with her antlers, while Snug and Flake watch and smile.', ['Pip', 'Snug', 'Flake']),
  D('cel-dance', 'Pip, Flake and Snug dance in a circle in the snow around a big pine tree that has a five-pointed star on top.', ['Pip', 'Flake', 'Snug']),
  D('rest-night', 'At night, Pip, Flake and Snug sit close together in the snow beside a big pine tree with a five-pointed star on top. A round moon and small stars are in the sky. They look sleepy and happy.', ['Pip', 'Flake', 'Snug']),
  D('end-wave', 'Pip, Flake and Snug stand in a row in the snow and wave goodbye toward the viewer.', ['Pip', 'Flake', 'Snug']),
  D('find-wind', 'A gust of wind lifts Flake\'s knit hat up off his head into the air. Flake looks up at the hat with wide eyes. Swirly wind lines and snowflakes fill the air.', ['Flake']),
  D('prob-hat-tree', 'Flake\'s knit hat hangs on a high branch of a big pine tree, far above Flake, who stands below without his hat and looks up at it.', ['Flake']),
  D('try-snowball', 'Snug throws a snowball up toward a knit hat that hangs on a high branch of a big pine tree, and the snowball flies past the hat.', ['Snug']),
  D('help-pip-antlers', 'Pip stretches up tall under a big pine tree and lifts a knit hat off a high branch with her antlers.', ['Pip']),
  D('solve-hat-back', 'Flake wears his knit hat on his head again and smiles, with Pip and Snug standing beside him in the snow.', ['Flake', 'Pip', 'Snug']),
  D('cel-sled-together', 'Pip, Flake and Snug ride one long wooden sled down a snowy hill together, all smiling, with snow spraying up behind the sled.', ['Pip', 'Flake', 'Snug']),
];

export interface BookStory { id: string; title: string; level: 'pre-k' | 'kindergarten'; cover: string; pages: [scene: string, text: string][] }

// Pre-K pages: 1 to 2 short sentences, at most 14 words. Kindergarten: 1 to 3 short sentences, at most 30 words.
export const CHRISTMAS_STORIES: BookStory[] = [
  { id: 'star', title: 'The Star in the Snow', level: 'pre-k', cover: 'end-wave', pages: [
    ['open-friends', 'Pip the reindeer, Flake the snowman and Snug the bear say hi, {{name}}!'],
    ['find-star', 'Snug holds up a big star for the top of the tree.'],
    ['prob-star-falls', 'Oh no! The star drops into the deep snow.'],
    ['try-dig', 'Snug digs and digs. Dig, dig, dig! No star yet.'],
    ['help-pip-nose', '"Pip can sniff for it!" says {{name}}. Pip finds the star.'],
    ['solve-star-top', 'Pip puts the star on top of the tree.'],
    ['cel-dance', 'The friends dance by the tree. {{name}} claps!'],
    ['rest-night', 'The moon is up. Good night, {{name}}!'],
  ] },
  { id: 'hat', title: 'The Hat in the Tree', level: 'kindergarten', cover: 'open-friends', pages: [
    ['open-cabin', 'Flake the snowman stands by a little log cabin. He waves his stick arm. "Come and play in the snow, {{name}}!"'],
    ['exp-sled', 'Pip the reindeer and Snug the bear zoom down the hill on a sled. Wheee! Snow sprays up behind them.'],
    ['find-wind', 'Whoosh! The wind blows. Up, up, up goes Flake\'s warm hat!'],
    ['prob-hat-tree', 'Oh no! The hat is stuck on a high branch of the pine tree. Flake looks up. His stick arms are too short.'],
    ['try-snowball', 'Snug throws a snowball at the hat. Up, up, up! But the snowball flies right past it.'],
    ['help-pip-antlers', '"Pip is tall!" says {{name}}. Pip stretches up and gets the hat with her antlers.'],
    ['solve-hat-back', 'Flake has his hat back on his head. "Thank you, Pip! Thank you, {{name}}!" says Flake.'],
    ['cel-sled-together', 'Pip, Flake and Snug ride the sled down the hill. Wheee! {{name}} cheers for the friends.'],
    ['rest-night', 'The moon comes up over the pine tree. The friends sit close in the snow. They are sleepy and happy.'],
    ['end-wave', 'Pip, Flake and Snug wave goodbye. "Merry Christmas, {{name}}!"'],
  ] },
];
