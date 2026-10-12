import { defineCollection } from "astro:content";
import { file } from "astro/loaders";
import { z } from "astro/zod";

/**
 * Selected work. Structure lives here, text lives in content.md as
 * `work_<id>_title` and `work_<id>_text` so it gets translated with everything else.
 */
const work = defineCollection({
  loader: file("src/data/work.json"),
  schema: z.object({
    id: z.string().regex(/^[a-z0-9]+$/),
    industry: z.string(),
    year: z.string(),
    url: z.url().optional(),
  }),
});

export const collections = { work };
