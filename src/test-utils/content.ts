import { collections } from "#/site/catalog";
import type { Collection, Entry } from "#/site/catalog";

// Real site content, for tests that verify the site's actual content or publication state.
//
// Tests that only need entries should use `./collection` instead. Tests of catalog consumers should
// mock `./catalog`. Unlike this file, both are unaffected by content additions or publication.

interface SiteCollection {
  collection: Collection;
  entries: Array<Entry>;
}

/** Returns the site's `segment` collection and its listing. Throws when the collection does not exist. */
export function siteCollection(segment: string): SiteCollection {
  const collection = collections[segment];

  if (!collection) {
    throw new Error(`This suite expects a \`${segment}\` collection.`);
  }

  return { collection, entries: collection.list() };
}

/** Returns the newest entry in the site's `segment` collection, or `null` if there are no entries. Throws when the collection is missing. */
export function newestEntry(segment: string): Entry | null {
  return siteCollection(segment).entries[0] ?? null;
}
