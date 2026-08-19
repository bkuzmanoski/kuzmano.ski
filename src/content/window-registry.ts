import { NOT_FOUND_TITLE } from "#/config/site";
import { collections, pages } from "#/content";
import type { Collection, ContentIndex } from "#/content";
import type { WindowId } from "#/lib/window-manager";

// The type of window a route opens.
type WindowTarget = {
  [K in WindowId]: { id: K; title: string } & {
    entry: { slug: string; collectionRoute: string | null; contentIndex: ContentIndex };
    collection: { collection: Collection; route: string };
    notFound: Record<never, never>;
  }[K];
}[WindowId];

/** A window that shows one entry, read from a content index. */
export type EntryTarget = Extract<WindowTarget, { id: "entry" }>;

/** A window that lists collection entries. */
export type CollectionTarget = Extract<WindowTarget, { id: "collection" }>;

/** A window that reports a route with no matching content. */
export type NotFoundTarget = Extract<WindowTarget, { id: "notFound" }>;

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
 * A collection entry is associated with its containing collection; a page or a collection is
 * associated with its own route. Returns `null` for routes that do not open a window.
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
