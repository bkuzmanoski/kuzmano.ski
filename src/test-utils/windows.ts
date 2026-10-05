import type { Collection } from "#/site/catalog.ts";
import type { CollectionEntryTarget, EntryTarget } from "#/site/windows.ts";

/** The window target for the page at `slug`. */
export const pageTargetOf = (slug: string, title = slug): EntryTarget => ({
  id: "entry",
  title,
  slug,
  collection: null,
});

/** The window target for the entry at `slug` in `collection`. */
export const collectionEntryTargetOf = (collection: Collection, slug: string): CollectionEntryTarget => ({
  id: "entry",
  title: collection.frontmatterOf(slug)?.title ?? slug,
  slug,
  collection,
});
