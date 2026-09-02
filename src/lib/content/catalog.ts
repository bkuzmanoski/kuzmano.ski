import { byNewestDate } from "../date";
import { trackPromise } from "../tracked-promise";

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

/** A collection has no document of its own to carry frontmatter, so it is described separately. */
export interface CollectionMetadata {
  title: string;
  description: string;
}

/**
 * The compiled content a catalog reads, as `import.meta.glob` returns it.
 *
 * Every record is keyed by the path the glob used, and `root` is the directory those paths
 * share, without a trailing slash (see `/src/site/catalog.ts`).
 */
export interface ContentSource {
  root: string;
  frontmatter: Record<string, { default: unknown }>;
  content: Record<string, () => Promise<{ default: MDXContent }>>;
  styles: Record<string, () => Promise<{ default: { page?: string } }>>;
  assets: Record<string, string | undefined>;
}

export interface Catalog {
  pages: ContentIndex;
  collections: Record<string, Collection>;
}

export interface CatalogOptions {
  pagesDirectory: string;
  collections: Record<string, CollectionMetadata>;
  includeDrafts: boolean;
}

export function createCatalog(source: ContentSource, options: CatalogOptions): Catalog {
  const loadedModules = new Map<string, Promise<MDXModule>>();

  const frontmatterFromPath = (path: string) => parseFrontmatter(source.frontmatter[path]?.default, path);

  function loadContent(path: string): Promise<MDXModule> {
    const loadedModule = loadedModules.get(path);

    if (loadedModule) {
      return loadedModule;
    }

    const importer = source.content[path];

    if (!importer) {
      throw new Error(`Content not found for path: ${path}`);
    }

    const stylesheet = source.styles[path.replace(/\.mdx$/, ".module.css")];
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
    const prefix = `${source.root}/${directory}/`;
    const paths = new Map<string, string>();

    for (const path of Object.keys(source.content)) {
      if (path.startsWith(prefix)) {
        paths.set(path.slice(prefix.length).replace(/\.mdx$/, ""), path);
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
          return (path && source.assets[path]) ?? null;
        },
      },
    };
  }

  function collection(directory: string, { title, description }: CollectionMetadata): Collection {
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
          .filter((entry) => !entry.draft || options.includeDrafts)
          .sort((a, b) => byNewestDate(a.date, b.date));

        return entries;
      },
    };
  }

  return {
    pages: contentIndex(options.pagesDirectory).index,
    collections: Object.fromEntries(
      Object.entries(options.collections).map(([segment, metadata]) => [segment, collection(segment, metadata)]),
    ),
  };
}

export type { Entry, Frontmatter };
