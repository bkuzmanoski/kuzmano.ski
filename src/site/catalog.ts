import { CONTENT_ASSETS } from "virtual:content-assets";

import { COLLECTIONS, PAGES_DIRECTORY } from "#/config/content.ts";
import { createCatalog } from "#/lib/content/catalog.ts";

import type { MDXContent } from "mdx/types";

const catalog = createCatalog(
  {
    root: "/content",
    frontmatter: import.meta.glob<{ default: unknown }>("/content/*/*.mdx", { query: "?frontmatter", eager: true }), // Frontmatter without the compiled bodies (see `/build/frontmatter.ts`).
    content: import.meta.glob<{ default: MDXContent }>("/content/*/*.mdx"),
    styles: import.meta.glob<{ default: { entry?: string } }>("/content/*/*.module.css"),
    assets: CONTENT_ASSETS,
  },
  { pagesDirectory: PAGES_DIRECTORY, collections: COLLECTIONS, includeDrafts: import.meta.env.DEV },
);

export const { collections, pages } = catalog;

export type { Collection, ContentIndex, Entry, Frontmatter, MDXModule } from "#/lib/content/catalog.ts";
