import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SITE } from './src/config.ts';
import { makeLastmod } from './scripts/lastmod.mjs';

// Sitemap lastmod: articles use their frontmatter `updated` (or `published`) date; every other page uses the date of
// the last git commit that changed its page file or the data it reads. A page we can't date gets no lastmod.
const gitLastmod = makeLastmod(fileURLToPath(new URL('.', import.meta.url)));
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
  } catch { /* no articles yet */ }
  return dates;
})();
const newestArticle = [...articleDates.values()].sort().at(-1);

function lastmodFor(url) {
  const path = new URL(url).pathname;
  const slug = path.match(/^\/learn\/([^/]+)\/$/)?.[1];
  if (slug) return articleDates.get(slug) ?? gitLastmod(path);
  if (path === '/learn/') return [newestArticle, gitLastmod(path)].filter(Boolean).sort().at(-1);
  return gitLastmod(path);
}

export default defineConfig({
  site: SITE.url,
  trailingSlash: 'always',
  output: 'static',
  adapter: vercel(),
  integrations: [
    preact(),
    sitemap({
      filter: (page) => !page.includes('/api/') && !page.includes('/404') && !page.includes('/account/') && !page.includes('/class-pack/') && !page.includes('/support/thank-you'),
      serialize: (item) => {
        const lastmod = lastmodFor(item.url);
        const { lastmod: _drop, ...rest } = item;
        return lastmod ? { ...rest, lastmod } : rest;
      },
    }),
  ],
  vite: { plugins: [tailwindcss()], build: { target: 'es2022' } },
});
