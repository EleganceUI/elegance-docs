import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			// A generated API page's kind ("Class", "Instance Method") and the page it's listed under
			// (scripts/gen-reference.mjs).
			extend: z.object({ symbol: z.object({ kind: z.string(), parent: z.string() }).optional() }),
		}),
	}),
};
