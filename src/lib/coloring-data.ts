// Coloring page library: only pages whose processed image exists in public/coloring are published.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import plan from '../data/coloring-plan.json';

export interface ColoringPage { slug: string; title: string; alt: string; description: string; src: string; thumb: string }
export interface ColoringCollection { slug: string; title: string; intro: string; primaryKeyword: string; season: string; pages: ColoringPage[] }

const root = join(process.cwd(), 'public', 'coloring');

export function getCollections(): ColoringCollection[] {
  return (plan.collections as any[])
    .map((c) => ({
      slug: c.slug,
      title: c.title,
      intro: c.intro,
      primaryKeyword: c.primaryKeyword,
      season: c.season,
      pages: (c.pages as any[])
        .filter((p) => existsSync(join(root, c.slug, `${p.slug}.png`)))
        .map((p) => ({
          slug: p.slug,
          title: p.title,
          alt: p.alt,
          description: p.description,
          src: `/coloring/${c.slug}/${p.slug}.png`,
          thumb: `/coloring/${c.slug}/${p.slug}-thumb.webp`,
        })),
    }))
    .filter((c) => c.pages.length > 0);
}
