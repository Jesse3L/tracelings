import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string(),
    description: z.string(),
    primaryKeyword: z.string(),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    readingMinutes: z.number(),
  }),
});

export const collections = { articles };
