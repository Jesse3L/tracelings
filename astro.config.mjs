import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import { SITE } from './src/config.ts';

export default defineConfig({
  site: SITE.url,
  trailingSlash: 'always',
  output: 'static',
  adapter: vercel(),
  integrations: [preact(), sitemap({ filter: (page) => !page.includes('/api/') })],
  vite: { plugins: [tailwindcss()], build: { target: 'es2022' } },
});
