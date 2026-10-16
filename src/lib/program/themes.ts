// TEMP stand-in for Part A's themes.ts so Part B builds on its own branch. Delete when Part A lands.
import type { ThemeId } from './types';

export const THEMES: Record<ThemeId, { label: string; words: string[] }> = {
  dinosaurs: { label: 'Dinosaurs', words: ['dinosaur', 'egg', 'nest', 'tail', 'roar', 'big', 'stomp'] },
  trucks: { label: 'Trucks and cars', words: ['truck', 'car', 'wheel', 'road', 'dump', 'honk', 'go'] },
  unicorns: { label: 'Unicorns', words: ['unicorn', 'horn', 'star', 'rainbow', 'sparkle', 'hop'] },
  ocean: { label: 'Ocean animals', words: ['fish', 'crab', 'shell', 'wave', 'whale', 'sand'] },
  space: { label: 'Space', words: ['rocket', 'moon', 'star', 'sun', 'planet', 'zoom'] },
  farm: { label: 'Farm animals', words: ['cow', 'pig', 'hen', 'barn', 'egg', 'goat'] },
  bugs: { label: 'Bugs', words: ['bug', 'ant', 'bee', 'web', 'leaf', 'hop'] },
  castles: { label: 'Princesses and castles', words: ['castle', 'crown', 'king', 'queen', 'tower', 'flag'] },
  trains: { label: 'Trains', words: ['train', 'track', 'car', 'toot', 'bell', 'stop'] },
  sports: { label: 'Sports', words: ['ball', 'kick', 'run', 'net', 'goal', 'bat'] },
  pets: { label: 'Pets', words: ['dog', 'cat', 'fish', 'pet', 'bed', 'pat'] },
  jungle: { label: 'Jungle animals', words: ['monkey', 'tiger', 'vine', 'tree', 'snake', 'swing'] },
};
export const themeLabel = (id: ThemeId) => THEMES[id]?.label ?? id;
