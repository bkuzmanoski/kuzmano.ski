import { COLLECTIONS, PAGE_SLUGS } from "#/config/content.ts";
import type * as SiteCatalog from "#/site/catalog.ts";
import type { Collection, Entry } from "#/site/catalog.ts";

import { fakeCollection, fakeCollectionEntries, fakeContentIndex, fakeEntry } from "./collection.ts";

// A `vi.mock` factory for `#/site/catalog`.
//
// A suite covering content the fixtures below do not hold, such as a draft, passes its own
// collections or pages as `overrides`.

export const collectionEntries = fakeCollectionEntries("newest-entry", "middle-entry", "oldest-entry");
export const collection = fakeCollection(collectionEntries, { title: "Collection", route: "/collection" });
export const otherCollection = fakeCollection(fakeCollectionEntries("other-entry"), {
  title: "Other Collection",
  route: "/other-collection",
});

// The return type is the module being replaced, so an export added to the catalog fails to
// typecheck here rather than arriving as `undefined` in the suites that mock it.
export const siteCatalogMock = (overrides: Partial<typeof SiteCatalog> = {}): typeof SiteCatalog => ({
  pages: fakeContentIndex([fakeEntry("page", { title: "Page" })]),
  collections: { collection, "other-collection": otherCollection },
  ...overrides,
});

export const configuredPages: Record<string, Entry> = Object.fromEntries(
  PAGE_SLUGS.map((slug) => [slug, fakeEntry(slug)]),
);

export const configuredCollections: Record<string, Collection> = Object.fromEntries(
  Object.entries(COLLECTIONS).map(([segment, { title, description }]) => [
    segment,
    fakeCollection(fakeCollectionEntries(`${segment}-newest-entry`, `${segment}-oldest-entry`), {
      title,
      description,
      route: `/${segment}`,
    }),
  ]),
);

export const configuredCatalogMock = (overrides: Partial<typeof SiteCatalog> = {}): typeof SiteCatalog => ({
  pages: fakeContentIndex(Object.values(configuredPages)),
  collections: configuredCollections,
  ...overrides,
});
