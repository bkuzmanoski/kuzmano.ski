import { COLLECTIONS, PAGES_DIRECTORY } from "#/config/content";

import { parseFrontmatter } from "./schema";

import type { Entry, Frontmatter } from "./schema";
import type { MDXContent } from "mdx/types";

interface MDXModule {
  default: MDXContent;
}

/** Slug-keyed lookup of the content in a directory. */
export interface ContentIndex {
  has: (slug: string) => boolean;
  frontmatterOf: (slug: string) => Frontmatter | null;
  load: (slug: string) => Promise<MDXModule>; // The compiled body, in a chunk of its own.
}

/** A content index that enumerates what it holds, most recent first. */
export interface Collection extends ContentIndex {
  title: string;
  description: string;
  route: string;
  routeOf: (slug: string) => string;
  list: () => Array<Entry>;
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

function contentIndex(directory: string): { index: ContentIndex; paths: Map<string, string> } {
  const prefix = `./${directory}/`;
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
      frontmatterOf(slug) {
        const path = paths.get(slug);
        return path ? frontmatterFromPath(path) : null;
      },
      load(slug) {
        const path = paths.get(slug);

        if (!path) {
          throw new Error(`Content not found: ${directory}/${slug}`);
        }

        return loadContent(path);
      },
    },
  };
}

function collection(directory: string, title: string, description: string): Collection {
  const { paths, index } = contentIndex(directory);
  const route = `/${directory}`; // The directory a collection reads from is also the segment it is served under.

  let entries: Array<Entry> | null = null;

  return {
    ...index,
    title,
    description,
    route,
    routeOf: (slug) => `${route}/${slug}`,
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
  Object.entries(COLLECTIONS).map(([segment, { title, description }]) => [
    segment,
    collection(segment, title, description),
  ]),
);
export const pages: ContentIndex = contentIndex(PAGES_DIRECTORY).index;

export type { Entry, Frontmatter };
