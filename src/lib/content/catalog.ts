import { byNewestDate } from "../datetime.ts";
import { trackPromise } from "../tracked-promise.ts";

import { entryKey, entrySlugOf, stylesheetFilePathOf } from "./entry-file.ts";
import { parseFrontmatter } from "./frontmatter.ts";
import { collectionRoute, entryRoute } from "./paths.ts";

import type { EntryKey } from "./entry-file.ts";
import type { Frontmatter } from "./frontmatter.ts";
import type { MDXContent } from "mdx/types";

export interface Entry extends Frontmatter {
  slug: string;
}

/**
 * The classes an entry's stylesheet (`<slug>.module.css`) can define: `entry` on the entry's
 * `<article>`, and `title` on its `<h1>`.
 */
export interface EntryStylesheetClassNames {
  entry?: string;
  title?: string;
}

export interface MDXModule {
  default: MDXContent;
  stylesheetClassNames?: EntryStylesheetClassNames; // Absent when the entry has no stylesheet.
}

/**
 * The client chunks and stylesheets loaded by an entry: its body chunk, the chunk of its stylesheet,
 * and the chunks those import, other than the chunks the document loads for every page.
 */
export interface EntryBodyChunks {
  moduleUrls: Array<string>;
  stylesheetUrls: Array<string>;
}

/** Slug-keyed lookup of the content in a directory. */
export interface ContentIndex {
  has: (slug: string) => boolean;
  entryKeyOf: (slug: string) => EntryKey;
  frontmatterOf: (slug: string) => Frontmatter | null;
  bodyChunksOf: (slug: string) => EntryBodyChunks | null; // For a document to load the body and its stylesheets before hydration.
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

interface CollectionMetadata {
  title: string;
  description: string;
}

export interface ContentSource {
  rootDirectoryPath: string; // The directory the content glob read from, without a trailing slash.
  frontmatterModules: Record<string, { default: unknown }>;
  bodyModules: Record<string, () => Promise<{ default: MDXContent }>>;
  stylesheetModules: Record<string, () => Promise<{ default: EntryStylesheetClassNames }>>;
  bodyChunks: Record<EntryKey, EntryBodyChunks | undefined>;
}

export interface Catalog {
  pages: ContentIndex;
  collections: Record<string, Collection>;
}

export interface CatalogOptions {
  pagesDirectoryName: string;
  collections: Record<string, CollectionMetadata>;
  includeDrafts: boolean;
}

export function createCatalog(source: ContentSource, options: CatalogOptions): Catalog {
  const loadedModules = new Map<string, Promise<MDXModule>>();

  const frontmatterFromFilePath = (filePath: string) =>
    parseFrontmatter(source.frontmatterModules[filePath]?.default, filePath);

  function loadContent(filePath: string): Promise<MDXModule> {
    const loadedModule = loadedModules.get(filePath);

    if (loadedModule) {
      return loadedModule;
    }

    const importBody = source.bodyModules[filePath];

    if (!importBody) {
      throw new Error(`Content not found for path: ${filePath}`);
    }

    const stylesheetImporter = source.stylesheetModules[stylesheetFilePathOf(filePath)];
    const modulePromise: Promise<MDXModule> = stylesheetImporter
      ? Promise.all([importBody(), stylesheetImporter()]).then(([bodyModule, stylesheetModule]) => ({
          ...bodyModule,
          stylesheetClassNames: stylesheetModule.default,
        }))
      : importBody();
    const trackedPromise = trackPromise(modulePromise); // Tracked so an entry whose module has already loaded can render without suspending. This keeps hydration from discarding the server-rendered article (see `/src/client.tsx`).

    loadedModules.set(filePath, trackedPromise);

    return trackedPromise;
  }

  function contentIndex(directoryName: string): { index: ContentIndex; filePathsBySlug: Map<string, string> } {
    const prefix = `${source.rootDirectoryPath}/${directoryName}/`;
    const filePathsBySlug = new Map<string, string>();

    for (const filePath of Object.keys(source.bodyModules)) {
      if (filePath.startsWith(prefix)) {
        filePathsBySlug.set(entrySlugOf(filePath.slice(prefix.length)), filePath);
      }
    }

    return {
      filePathsBySlug,
      index: {
        has: (slug) => filePathsBySlug.has(slug),
        entryKeyOf: (slug) => entryKey(directoryName, slug),
        frontmatterOf(slug) {
          const filePath = filePathsBySlug.get(slug);
          return filePath ? frontmatterFromFilePath(filePath) : null;
        },
        bodyChunksOf: (slug) => source.bodyChunks[entryKey(directoryName, slug)] ?? null,
        load(slug) {
          const filePath = filePathsBySlug.get(slug);

          if (!filePath) {
            throw new Error(`Content not found: ${directoryName}/${slug}`);
          }

          return loadContent(filePath);
        },
      },
    };
  }

  function collection(directoryName: string, { title, description }: CollectionMetadata): Collection {
    const { filePathsBySlug, index } = contentIndex(directoryName);
    const route = collectionRoute(directoryName); // The directory a collection reads from is also the segment it is served under.

    let entries: Array<Entry> | null = null;

    return {
      ...index,
      title,
      description,
      route,
      routeOf: (slug) => entryRoute(directoryName, slug),
      list() {
        entries ??= [...filePathsBySlug]
          .map(([slug, filePath]) => ({ ...frontmatterFromFilePath(filePath), slug }))
          .filter((entry) => !entry.draft || options.includeDrafts)
          .sort((a, b) => byNewestDate(a.date, b.date));

        return entries;
      },
    };
  }

  return {
    pages: contentIndex(options.pagesDirectoryName).index,
    collections: Object.fromEntries(
      Object.entries(options.collections).map(([segment, metadata]) => [segment, collection(segment, metadata)]),
    ),
  };
}

export type { Frontmatter };
export type { ContentImage, CoverImage, PictureSource } from "./media.ts";
