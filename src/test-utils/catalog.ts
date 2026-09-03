import type * as SiteCatalog from "#/site/catalog";

import { fakeCollection, fakeContentIndex, fakeEntries, fakeEntry } from "./collection";

/**
 * A `vi.mock` factory for `#/site/catalog`.
 *
 * A suite covering content the fixtures below do not hold, such as a draft, passes its own
 * collections or pages as `overrides`.
 */

export const pageEntries = [fakeEntry("page", { title: "Page" })];
export const collectionEntries = fakeEntries("newest-entry", "middle-entry", "oldest-entry");
export const otherCollectionEntries = fakeEntries("other-entry");

export const pagesIndex = fakeContentIndex(pageEntries);
export const collection = fakeCollection(collectionEntries, { title: "Collection", route: "/collection" });
export const otherCollection = fakeCollection(otherCollectionEntries, {
  title: "Other Collection",
  route: "/other-collection",
});

// The return type is the module being replaced, so an export added to the catalog fails to
// typecheck here rather than arriving as `undefined` in the suites that mock it.
export const siteCatalogMock = (overrides: Partial<typeof SiteCatalog> = {}): typeof SiteCatalog => ({
  pages: pagesIndex,
  collections: { collection, "other-collection": otherCollection },
  ...overrides,
});
