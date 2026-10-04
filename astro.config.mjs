import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import { readdirSync, readFileSync } from 'node:fs';
import { SITE } from './src/config.ts';

// Sitemap lastmod: articles use their frontmatter `updated` (or `published`) date; everything else uses the build date.
const BUILD_DATE = new Date().toISOString();
const articleDates = (() => {
  const dates = new Map();
  try {
    const dir = new URL('./src/content/articles/', import.meta.url);
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const fm = readFileSync(new URL(file, dir), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
      const pick = (key) => fm.match(new RegExp(`^${key}:\\s*["']?([0-9]{4}-[0-9]{2}-[0-9]{2})`, 'm'))?.[1];
      const date = pick('updated') ?? pick('published');
      if (date && !Number.isNaN(Date.parse(date))) dates.set(file.replace(/\.md$/, ''), new Date(date).toISOString());
    }
  } catch { /* no articles yet: fall back to the build date */ }
  return dates;
})();
const newestArticle = [...articleDates.values()].sort().at(-1);

function lastmodFor(url) {
  const path = new URL(url).pathname;
  const slug = path.match(/^\/learn\/([^/]+)\/$/)?.[1];
  if (slug) return articleDates.get(slug) ?? BUILD_DATE;
  if (path === '/learn/') return newestArticle ?? BUILD_DATE;
  return BUILD_DATE;
}

export default defineConfig({
  site: SITE.url,
  trailingSlash: 'always',
  output: 'static',
  adapter: vercel(),
  integrations: [
    preact(),
    sitemap({
      filter: (page) => !page.includes('/api/') && !page.includes('/404') && !page.includes('/account/') && !page.includes('/class-pack/'),
      serialize: (item) => ({ ...item, lastmod: lastmodFor(item.url) }),
    }),
  ],
  vite: { plugins: [tailwindcss()], build: { target: 'es2022' } },
});
