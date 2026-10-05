import type { Collection, Entry } from "./catalog.ts";

/** Adjacent newer and older entries in a collection ordered newest first. */
export interface EntrySiblings {
  newer: Entry | null;
  older: Entry | null;
}

const NO_SIBLINGS: EntrySiblings = { newer: null, older: null };

export function entrySiblings(collection: Collection, slug: string): EntrySiblings {
  const entries = collection.list();
  const index = entries.findIndex((entry) => entry.slug === slug);

  if (index === -1) {
    return NO_SIBLINGS;
  }

  return { newer: entries[index - 1] ?? null, older: entries[index + 1] ?? null };
}
