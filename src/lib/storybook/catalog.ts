// Every personalized storybook for sale: the two Christmas books plus the hand-written picture book stories from the
// program (src/lib/program/storyTexts.ts), each with its scene art. Server code reads full stories from here; the
// sale page only gets `bookMeta` (title, cover, first page) through Astro props.
import { STORY_TEXTS } from '../program/storyTexts';
import { THEMES } from '../program/themes';
import { sceneSrc, SCENES } from '../program/scenes';
import type { ThemeId } from '../program/types';
import art from '../program/sceneArt.json';
import { CHRISTMAS_STORIES } from './christmas';
import type { GiftBook } from './giftbook';

export type BookTheme = ThemeId | 'christmas';
export interface BookEntry extends GiftBook { id: string; theme: BookTheme; group: string; level: 'pre-k' | 'kindergarten' }
export interface BookMeta { id: string; theme: BookTheme; group: string; kind: string; title: string; level: 'pre-k' | 'kindergarten'; pages: number; cover: GiftBook['cover']; first: GiftBook['pages'][number] }

/** The storybook price, in cents. */
export const BOOK_CENTS = 500;

const KIND: Record<BookTheme, string> = {
  christmas: 'A Christmas story', dinosaurs: 'A dinosaur story', trucks: 'A truck story', unicorns: 'A unicorn story', ocean: 'An ocean story',
  space: 'A space story', farm: 'A farm story', bugs: 'A bug story', castles: 'A castle story', trains: 'A train story',
  sports: 'A sports story', pets: 'A pet story', jungle: 'A jungle story',
};

const XMAS = { w: 2400, h: 1800 };
const xmasPic = (id: string) => ({ src: `/storybook/christmas/${id}.png`, ...XMAS });
const manifest = art as unknown as Record<string, Record<string, { w: number; h: number }>> & { pathsReady?: Record<string, string[]> };
const themePic = (theme: ThemeId, id: string) => ({ src: sceneSrc(theme, id), ...(manifest[theme]?.[id] ?? { w: 2400, h: 1800 }) });
/** The week's teaching line slot in the program stories; the storybook has none. */
const clean = (t: string) => t.replace(/\s*\{W\}/g, '').trim();

function build(): BookEntry[] {
  const out: BookEntry[] = CHRISTMAS_STORIES.map((s) => ({
    id: `christmas/${s.id}`, theme: 'christmas', group: 'Christmas', kind: KIND.christmas, level: s.level, title: s.title,
    cover: xmasPic(s.cover), pages: s.pages.map(([scene, text]) => ({ ...xmasPic(scene), text })),
  }));
  for (const theme of Object.keys(STORY_TEXTS) as ThemeId[]) {
    const ready = new Set(manifest.pathsReady?.[theme] ?? []);
    for (const [pathId, s] of Object.entries(STORY_TEXTS[theme])) {
      if (!ready.has(pathId)) continue;
      const scenes = s.pages.map(([scene]) => scene);
      // Cover: a happy picture with the whole cast (not page 1), so the cover shows all the friends.
      const full = SCENES[theme].cast.length;
      const happy = SCENES[theme].scenes.filter((sc) => sc.cast.length === full && ['opening', 'ending', 'celebrate', 'rest'].includes(sc.beat) && sc.id !== scenes[0] && manifest[theme]?.[sc.id])
        .sort((a, b) => ['opening', 'ending', 'rest', 'celebrate'].indexOf(a.beat) - ['opening', 'ending', 'rest', 'celebrate'].indexOf(b.beat));
      const coverId = happy.find((sc) => !scenes.includes(sc.id))?.id ?? happy[0]?.id ?? scenes[1] ?? scenes[0];
      out.push({
        id: `${theme}/${pathId}`, theme, group: THEMES[theme].label, kind: KIND[theme], level: s.pages.length > 8 ? 'kindergarten' : 'pre-k', title: s.title,
        cover: themePic(theme, coverId), pages: s.pages.map(([scene, text]) => ({ ...themePic(theme, scene), text: clean(text) })),
      });
    }
  }
  return out;
}

export const BOOKS: BookEntry[] = build();
export const bookById = (id: string) => BOOKS.find((b) => b.id === id);
export const bookMeta = (b: BookEntry): BookMeta => ({ id: b.id, theme: b.theme, group: b.group, kind: b.kind, title: b.title, level: b.level, pages: b.pages.length, cover: b.cover, first: b.pages[0] });
/** The full book the buyer's browser builds the PDF from (text keeps {{name}}). */
export const bookBody = (b: BookEntry): GiftBook => ({ title: b.title, kind: b.kind, cover: b.cover, pages: b.pages });
