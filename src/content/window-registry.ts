import { collections, pages } from "#/content";
import type { Collection, ContentIndex } from "#/content";

export const NOT_FOUND_TITLE = "Page not found (404)";

/** A window that shows one entry, read from a content index. */
export interface EntryTarget {
  id: "entry";
  title: string;
  slug: string;
  collectionRoute: string | null; // The collection the entry came from, or `null` for a top-level entry.
  contentIndex: ContentIndex; // Where the entry is read from: top-level pages or the collection it belongs to.
}

/** A window that lists collection entries. */
export interface CollectionTarget {
  id: "collection";
  title: string;
  collection: Collection;
  route: string;
}

/** The type of window a route opens. */
export type WindowTarget = EntryTarget | CollectionTarget | { id: "notFound"; title: string };

export function resolveWindow(pathname: string): WindowTarget | null {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  const segment = segments[0]!;
  const collection = collections[segment];

  if (segments.length === 1) {
    if (collection) {
      return { id: "collection", title: collection.title, collection, route: `/${segment}` };
    }

    if (pages.has(segment)) {
      return {
        id: "entry",
        title: pages.frontmatterOf(segment)?.title ?? segment,
        slug: segment,
        collectionRoute: null,
        contentIndex: pages,
      };
    }
  }

  if (segments.length === 2) {
    const slug = segments[1]!;

    if (collection?.has(slug)) {
      return {
        id: "entry",
        title: collection.frontmatterOf(slug)?.title ?? slug,
        slug,
        collectionRoute: `/${segment}`,
        contentIndex: collection,
      };
    }
  }

  return { id: "notFound", title: NOT_FOUND_TITLE };
}

/**
 * Returns the desktop destination route associated with an open window.
 *
 * A collection entry is associated with its containing collection; a top-level entry or a
 * collection is associated with its own route. Returns `null` for routes that do not open a
 * window.
 */
export function destinationRouteOf(windowRoute: string): string | null {
  const target = resolveWindow(windowRoute);

  switch (target?.id) {
    case "entry":
      return target.collectionRoute ?? windowRoute;

    case "collection":
      return target.route;

    default:
      return null;
  }
}
