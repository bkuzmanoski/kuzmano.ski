import { collections } from "#/content";
import type { Entry } from "#/content";

/** Returns the newest entry in a collection. Throws if the collection is empty. */
export function newestEntry(collection: string): Entry {
  const entry = collections[collection]?.list()[0];

  if (!entry) {
    throw new Error(`This suite expects at least one ${collection} entry.`);
  }

  return entry;
}
