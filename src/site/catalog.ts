import { ENTRY_BODY_CHUNKS } from "virtual:entry-body-chunks";
import { ENTRY_ICON_URLS } from "virtual:entry-icon-urls";

import { COLLECTIONS, PAGES_DIRECTORY_NAME } from "#/config/content.ts";
import { createCatalog } from "#/lib/content/catalog.ts";
import type { EntryStylesheetClassNames } from "#/lib/content/catalog.ts";

import type { MDXContent } from "mdx/types";

const catalog = createCatalog(
  {
    rootDirectoryPath: "/content",
    frontmatterModules: import.meta.glob<{ default: unknown }>("/content/*/*.mdx", {
      query: "?frontmatter",
      eager: true,
    }), // Frontmatter without the compiled bodies.
    entryIconUrls: ENTRY_ICON_URLS,
    bodyModules: import.meta.glob<{ default: MDXContent }>("/content/*/*.mdx"),
    stylesheetModules: import.meta.glob<{ default: EntryStylesheetClassNames }>("/content/*/*.module.css"),
    bodyChunks: ENTRY_BODY_CHUNKS,
  },
  { pagesDirectoryName: PAGES_DIRECTORY_NAME, collections: COLLECTIONS, includeDrafts: import.meta.env.DEV },
);

export const { collections, pages } = catalog;

export type {
  Collection,
  ContentIndex,
  Entry,
  EntryBodyChunks,
  Frontmatter,
  MDXModule,
} from "#/lib/content/catalog.ts";
