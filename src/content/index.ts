import { PAGES_DIRECTORY } from "#/config/content";
import { COLLECTION_TITLES } from "#/config/navigation";

import { parseFrontmatter } from "./schema";

import type { Frontmatter, Page } from "./schema";
import type { MDXContent } from "mdx/types";

interface MDXModule {
  default: MDXContent;
}

/** Slug-keyed lookup of MDX files. */
export interface PageIndex {
  has: (slug: string) => boolean;
  frontmatter: (slug: string) => Frontmatter | null;
  load: (slug: string) => Promise<MDXModule>;
}

/** An index that enumerates its entries. */
export interface Collection extends PageIndex {
  title: string;
  list: () => Array<Page>;
}

/**
 * Frontmatter without the compiled bodies (see the `?frontmatter` plugin in
 * build/). A listing synchronously reads titles, categories and dates without
 * pulling in page bodies.
 */
const frontmatterModules = import.meta.glob<{ default: unknown }>("./*/*.mdx", { query: "?frontmatter", eager: true });

const contentModules = import.meta.glob<MDXModule>("./*/*.mdx");
const contentCache = new Map<string, Promise<MDXModule>>();

const slugFromPath = (path: string) => path.replace(/^\.\/[^/]+\//, "").replace(/\.mdx$/, "");
const frontmatterFromPath = (path: string) => parseFrontmatter(frontmatterModules[path]?.default, path);

function loadContent(path: string): Promise<MDXModule> {
  const cachedContent = contentCache.get(path);

  if (cachedContent) {
    return cachedContent;
  }

  const importer = contentModules[path];

  if (!importer) {
    throw new Error(`Content not found for path: ${path}`);
  }

  const promise = importer();

  contentCache.set(path, promise);

  return promise;
}

function pageIndex(name: string): { index: PageIndex; paths: Map<string, string> } {
  const prefix = `./${name}/`;
  const paths = new Map<string, string>();

  for (const path of Object.keys(contentModules)) {
    if (path.startsWith(prefix)) {
      paths.set(slugFromPath(path), path);
    }
  }

  return {
    paths,
    index: {
      has: (slug) => paths.has(slug),
      frontmatter(slug) {
        const path = paths.get(slug);
        return path ? frontmatterFromPath(path) : null;
      },
      load(slug) {
        const path = paths.get(slug);

        if (!path) {
          throw new Error(`Page not found: ${name}/${slug}`);
        }

        return loadContent(path);
      },
    },
  };
}

function collection(segment: string, title: string): Collection {
  const { paths, index } = pageIndex(segment);

  let entries: Array<Page> | null = null;

  return {
    ...index,
    title,
    list() {
      entries ??= [...paths]
        .map(([slug, path]) => ({ ...frontmatterFromPath(path), slug }))
        .filter((entry) => !entry.draft || import.meta.env.DEV)
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

      return entries;
    },
  };
}

export const collections: Record<string, Collection> = Object.fromEntries(
  Object.entries(COLLECTION_TITLES).map(([segment, title]) => [segment, collection(segment, title)]),
);
export const pages: PageIndex = pageIndex(PAGES_DIRECTORY).index;

export type { Page, Frontmatter };
