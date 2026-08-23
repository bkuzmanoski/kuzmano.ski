import { collections } from "#/content";
import type { Collection, Entry } from "#/content";

interface TestCollection {
  collection: Collection;
  entries: Array<Entry>;
  routeOf: (index: number) => string; // The route of the entry at `index` in the listing, newest first.
}

export function testCollection(segment: string, minimumEntries = 1): TestCollection {
  const collection = collections[segment];

  if (!collection) {
    throw new Error(`This suite expects a \`${segment}\` collection.`);
  }

  const entries = collection.list();

  if (entries.length < minimumEntries) {
    throw new Error(
      `This suite expects at least ${minimumEntries} \`${segment}\` ${minimumEntries === 1 ? "entry" : "entries"}.`,
    );
  }

  return { collection, entries, routeOf: (index) => collection.routeOf(entries[index]!.slug) };
}

/** Returns the newest entry in a collection. Throws if the collection is empty. */
export function newestEntry(segment: string): Entry {
  return testCollection(segment).entries[0]!;
}
