import { CONTENT_ASSETS } from "virtual:content-assets";

import { COLLECTIONS, PAGES_DIRECTORY } from "#/config/content";
import { createCatalog } from "#/lib/content/catalog";

import type { MDXContent } from "mdx/types";

const catalog = createCatalog(
  {
    root: "/src/content",
    frontmatter: import.meta.glob<{ default: unknown }>("/src/content/*/*.mdx", { query: "?frontmatter", eager: true }), // Frontmatter without the compiled bodies (see `/build/frontmatter.ts`).
    content: import.meta.glob<{ default: MDXContent }>("/src/content/*/*.mdx"),
    styles: import.meta.glob<{ default: { page?: string } }>("/src/content/*/*.module.css"),
    assets: CONTENT_ASSETS,
  },
  { collections: COLLECTIONS, pagesDirectory: PAGES_DIRECTORY, includeDrafts: import.meta.env.DEV },
);

export const { collections, pages } = catalog;

export type { Collection, ContentIndex, Entry, Frontmatter, MDXModule } from "#/lib/content/catalog";
