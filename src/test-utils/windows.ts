import type { Collection } from "#/site/catalog.ts";
import type { CollectionEntryTarget, EntryTarget } from "#/site/windows.ts";

export const pageTargetOf = (slug: string, title = slug): EntryTarget => ({
  id: "entry",
  title,
  slug,
  collection: null,
});

export const collectionEntryTargetOf = (collection: Collection, slug: string): CollectionEntryTarget => ({
  id: "entry",
  title: collection.frontmatterOf(slug)?.title ?? slug,
  slug,
  collection,
});
