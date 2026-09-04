import { createElement } from "react";

import type { Collection, ContentIndex, Entry, MDXModule } from "#/lib/content/catalog.ts";
import { trackPromise } from "#/lib/tracked-promise.ts";

import type { MDXContent } from "mdx/types";

const NEWEST_DATE = "2026-07-19";
const DAY = 86_400_000;
const ROUTE = "/collection";

const dateAt = (index: number) => new Date(Date.parse(NEWEST_DATE) - index * DAY).toISOString().slice(0, 10);

export function fakeEntry(slug: string, overrides: Partial<Entry> = {}): Entry {
  return { slug, title: slug, description: `About ${slug}.`, date: NEWEST_DATE, ...overrides };
}

export const fakeCollectionEntries = (...slugs: Array<string>): Array<Entry> =>
  slugs.map((slug, index) => fakeEntry(slug, { date: dateAt(index) }));

const fakeBody =
  (slug: string): MDXContent =>
  () =>
    createElement("p", null, `The body of ${slug}.`);

export function fakeContentIndex(entries: Array<Entry>): ContentIndex {
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  const modules = new Map<string, Promise<MDXModule>>();

  return {
    has: (slug) => bySlug.has(slug),
    frontmatterOf: (slug) => bySlug.get(slug) ?? null,
    assetOf: () => null,
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
  const route = overrides.route ?? ROUTE;
  return {
    ...fakeContentIndex(collectionEntries),
    title: "Collection",
    description: "A collection of entries.",
    route,
    routeOf: (slug) => `${route}/${slug}`,
    list: () => collectionEntries,
    ...overrides,
  };
}
