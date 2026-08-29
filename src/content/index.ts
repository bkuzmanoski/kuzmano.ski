import { CONTENT_ASSETS } from "virtual:content-assets";

import { COLLECTIONS, PAGES_DIRECTORY } from "#/config/content";
import { byNewestDate } from "#/lib/date";
import { trackPromise } from "#/lib/tracked-promise";

import { parseFrontmatter } from "./schema";

import type { Entry, Frontmatter } from "./schema";
import type { MDXContent } from "mdx/types";

/** A compiled MDX file and the optional class applied to its page. */
export interface MDXModule {
  default: MDXContent;
  className?: string;
}

/** Slug-keyed lookup of the content in a directory. */
export interface ContentIndex {
  has: (slug: string) => boolean;
  frontmatterOf: (slug: string) => Frontmatter | null;
  load: (slug: string) => Promise<MDXModule>; // The compiled body, in a chunk of its own.
  assetOf: (slug: string) => string | null; // The URL of the compiled body chunk, for a document to preload before hydration.
}

/** A content index that enumerates what it holds, most recent first. */
export interface Collection extends ContentIndex {
  title: string;
  description: string;
  route: string;
  routeOf: (slug: string) => string;
  list: () => Array<Entry>;
}

const frontmatterModules = import.meta.glob<{ default: unknown }>("./*/*.mdx", { query: "?frontmatter", eager: true }); // Frontmatter without the compiled bodies (see the `/build/frontmatter.ts`).
const contentModules = import.meta.glob<{ default: MDXContent }>("./*/*.mdx");
const styleModules = import.meta.glob<{ default: { page?: string } }>("./*/*.module.css");
const loadedModules = new Map<string, Promise<MDXModule>>();

const slugFromPath = (path: string) => path.replace(/^\.\/[^/]+\//, "").replace(/\.mdx$/, "");
const frontmatterFromPath = (path: string) => parseFrontmatter(frontmatterModules[path]?.default, path);

function loadContent(path: string): Promise<MDXModule> {
  const loadedModule = loadedModules.get(path);

  if (loadedModule) {
    return loadedModule;
  }

  const importer = contentModules[path];

  if (!importer) {
    throw new Error(`Content not found for path: ${path}`);
  }

  const stylesheet = styleModules[path.replace(/\.mdx$/, ".module.css")];
  const promise: Promise<MDXModule> = stylesheet
    ? Promise.all([importer(), stylesheet()]).then(([module, styles]) => ({
        ...module,
        className: styles.default.page,
      }))
    : importer();
  const trackedPromise = trackPromise(promise); // Tracked so a page whose module has already loaded can render without suspending. This keeps hydration from discarding the article the server sent (see `/src/client.tsx`).

  loadedModules.set(path, trackedPromise);

  return trackedPromise;
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
      assetOf(slug) {
        const path = paths.get(slug);
        return (path && CONTENT_ASSETS[path]) ?? null;
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
        .sort((a, b) => byNewestDate(a.date, b.date));

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
