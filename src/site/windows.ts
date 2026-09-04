import { CONTACT_DOCUMENT_TITLE, CONTACT_ROUTE } from "#/config/contact.ts";
import type { WindowId } from "#/lib/window-manager/window.ts";

import { pages } from "./catalog.ts";
import { isRootPath, parseContentPath } from "./content-routes.ts";
import { resolveContent } from "./resolve-content.ts";

import type { Collection, ContentIndex } from "./catalog.ts";
import type { ResolvedContent } from "./resolve-content.ts";

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

export type ResolvedRoute = WindowTarget | { id: "desktop" } | { id: "notFound" };

export function resolveRoute(route: string): ResolvedRoute {
  if (isRootPath(route)) {
    return { id: "desktop" };
  }

  const path = parseContentPath(route);
  const content: ResolvedContent = path ? resolveContent(path.segment, path.slug) : { kind: "notFound" };

  switch (content.kind) {
    case "page":
      return {
        id: "entry",
        title: content.frontmatter?.title ?? content.slug,
        slug: content.slug,
        collectionRoute: null,
        contentIndex: pages,
      };

    case "collectionEntry":
      return {
        id: "entry",
        title: content.frontmatter?.title ?? content.slug,
        slug: content.slug,
        collectionRoute: content.collection.route,
        contentIndex: content.collection,
      };

    case "collection":
      return {
        id: "collection",
        title: content.collection.title,
        collection: content.collection,
        collectionRoute: content.collection.route,
      };

    case "reserved":
      // Contact is the only reserved route, and the only one with a window of its own.
      return content.route === CONTACT_ROUTE ? { id: "contact", title: CONTACT_DOCUMENT_TITLE } : { id: "notFound" };

    default:
      return { id: "notFound" };
  }
}

/** The window a route opens, or `null` if it does not open a window. */
export function resolveWindow(route: string): WindowTarget | null {
  const resolvedRoute = resolveRoute(route);
  return resolvedRoute.id === "desktop" || resolvedRoute.id === "notFound" ? null : resolvedRoute;
}

function destinationShownBy(windowRoute: string): string | null {
  const target = resolveWindow(windowRoute);

  switch (target?.id) {
    case "entry":
    case "contact":
      return windowRoute;

    case "collection":
      return target.collectionRoute;

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
