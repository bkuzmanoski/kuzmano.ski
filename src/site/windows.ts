import { CONTACT_PAGE_ROUTE, CONTACT_PAGE_TITLE } from "#/config/contact";
import type { WindowId } from "#/lib/window-manager";

import { collections, pages } from "./catalog";

import type { Collection, ContentIndex } from "./catalog";

type WindowTarget = {
  [K in WindowId]: { id: K; title: string } & {
    entry: { slug: string } & (
      { collectionRoute: null; contentIndex: ContentIndex } | { collectionRoute: string; contentIndex: Collection }
    );
    collection: { collection: Collection; collectionRoute: string };
    contact: Record<never, never>;
  }[K];
}[WindowId];

/** A window that shows one entry, read from a content index. */
export type EntryTarget = Extract<WindowTarget, { id: "entry" }>;

/** A window that lists collection entries. */
export type CollectionTarget = Extract<WindowTarget, { id: "collection" }>;

/** The result of resolving a route: a window, the desktop, or a not-found page. */
export type ResolvedRoute = WindowTarget | { id: "desktop" } | { id: "notFound" };

const CONTACT_PAGE_SEGMENT = CONTACT_PAGE_ROUTE.slice(1);

export function resolveRoute(route: string): ResolvedRoute {
  const segments = route.split("/").filter(Boolean);

  if (segments.length === 0) {
    return { id: "desktop" };
  }

  const segment = segments[0]!;
  const collection = collections[segment];

  if (segments.length === 1) {
    if (segment === CONTACT_PAGE_SEGMENT) {
      return { id: "contact", title: CONTACT_PAGE_TITLE };
    }

    if (collection) {
      return { id: "collection", title: collection.title, collection, collectionRoute: collection.route };
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
        collectionRoute: collection.route,
        contentIndex: collection,
      };
    }
  }

  return { id: "notFound" };
}

/** The window a route opens, or `null` if it does not open a window. */
export function resolveWindow(route: string): WindowTarget | null {
  const resolvedRoute = resolveRoute(route);
  return resolvedRoute.id === "desktop" || resolvedRoute.id === "notFound" ? null : resolvedRoute;
}

function destinationShownBy(windowRoute: string): string | null {
  const target = resolveWindow(windowRoute);

  switch (target?.id) {
    case "collection":
      return target.collectionRoute;

    case "entry":
    case "contact":
      return windowRoute;

    default:
      return null;
  }
}

export function isDestinationOpen(destinationRoute: string, openWindowRoutes: Iterable<string>): boolean {
  for (const windowRoute of openWindowRoutes) {
    if (destinationShownBy(windowRoute) === destinationRoute) {
      return true;
    }
  }

  return false;
}
