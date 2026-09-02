import type { Collection } from "./catalog";

/** The routes of the entries either side of one in the collection that holds it, in listing order (newest first). */
export interface EntrySiblings {
  previous: string | null;
  next: string | null;
}

const NO_SIBLINGS: EntrySiblings = { previous: null, next: null };

export function entrySiblings(collection: Collection, slug: string): EntrySiblings {
  const entries = collection.list();
  const index = entries.findIndex((entry) => entry.slug === slug);

  if (index === -1) {
    return NO_SIBLINGS;
  }

  const routeAt = (position: number) => {
    const entry = entries[position];
    return entry ? collection.routeOf(entry.slug) : null;
  };

  return { previous: routeAt(index - 1), next: routeAt(index + 1) };
}
