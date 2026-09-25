import { createElement } from "react";

import type { Collection, ContentIndex, CoverImage, Entry, MDXModule } from "#/lib/content/catalog.ts";
import { entryKey } from "#/lib/content/entry-file.ts";
import { mediaRoute } from "#/lib/content/paths.ts";
import { trackPromise } from "#/lib/tracked-promise.ts";

import type { MDXContent } from "mdx/types";

const NEWEST_DATE = "2026-07-19";
const DAY_MS = 86_400_000;
const COLLECTION_DIRECTORY_NAME = "collection";

const dateAt = (index: number) => new Date(Date.parse(NEWEST_DATE) - index * DAY_MS).toISOString().slice(0, 10);
const fakeBody =
  (slug: string): MDXContent =>
  () =>
    createElement("p", null, `The body of ${slug}.`);

export function fakeCoverImage(slug: string): CoverImage {
  const coverImageUrlBase = mediaRoute(`${COLLECTION_DIRECTORY_NAME}/${slug}.cover.0f1e2d3c4b5a6978`); // Matches `MEDIA_FILE_HASH` in `/build/test-utils/media.ts`; `src` cannot import `build`.
  const placeholderFingerprint = "00000000";

  return {
    social: { src: `${coverImageUrlBase}.png`, width: 512, height: 512 },
    thumbnail: {
      kind: "image",
      src: `${coverImageUrlBase}.${placeholderFingerprint}.thumbnail.webp`,
      width: 128,
      height: 128,
      alternates: [{ srcSet: `${coverImageUrlBase}.${placeholderFingerprint}.thumbnail.avif`, type: "image/avif" }],
    },
  };
}

export function fakeEntry(slug: string, overrides: Partial<Entry> = {}): Entry {
  return { slug, title: slug, description: `About ${slug}.`, date: NEWEST_DATE, ...overrides };
}

export const fakeCollectionEntries = (...slugs: Array<string>): Array<Entry> =>
  slugs.map((slug, index) => fakeEntry(slug, { date: dateAt(index) }));

export function fakeContentIndex(entries: Array<Entry>, directoryName = COLLECTION_DIRECTORY_NAME): ContentIndex {
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  const modules = new Map<string, Promise<MDXModule>>();

  return {
    has: (slug) => bySlug.has(slug),
    entryKeyOf: (slug) => entryKey(directoryName, slug),
    frontmatterOf: (slug) => bySlug.get(slug) ?? null,
    bodyChunksOf: () => null,
    load(slug) {
      if (!bySlug.has(slug)) {
        throw new Error(`Content not found: ${slug}`);
      }

      // Memoized and tracked, as the real catalog memoizes and tracks, so
      // a body that has already loaded renders without suspending again.
      const module = modules.get(slug) ?? trackPromise(Promise.resolve({ default: fakeBody(slug) }));

      modules.set(slug, module);

      return module;
    },
  };
}

export function fakeCollection(collectionEntries: Array<Entry>, overrides: Partial<Collection> = {}): Collection {
  const route = overrides.route ?? `/${COLLECTION_DIRECTORY_NAME}`;
  return {
    ...fakeContentIndex(collectionEntries, route.slice(1)), // A collection is served under the name of its directory.
    title: "Collection",
    description: "A collection of entries.",
    route,
    routeOf: (slug) => `${route}/${slug}`,
    list: () => collectionEntries,
    ...overrides,
  };
}
