import { collections, pages } from "#/content";
import type { Collection } from "#/content";

/**
 * The windows the desktop can open. Every route resolves to exactly one of them,
 * and each one exists at most once: a route that resolves to an open window
 * replaces what that window shows instead of opening a second one.
 */
export type WindowId = "collection" | "page" | "notFound";

/** Every window id, in the order the window layer writes them to the DOM. */
export const WINDOW_IDS = ["collection", "page", "notFound"] as const satisfies ReadonlyArray<WindowId>;

/** Whether a window shows a list of its own beside its body. */
export const hasSidebar = (id: WindowId) => id === "collection";

export const NOT_FOUND_TITLE = "Page not found (404)";

export type WindowTarget =
  | { id: "collection"; title: string; collection: Collection; basePath: string; entrySlug: string | null }
  | { id: "page"; title: string; slug: string }
  | { id: "notFound"; title: string };

export function resolveWindow(pathname: string): WindowTarget | null {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  const segment = segments[0]!;
  const collection = collections[segment];

  if (segments.length === 1) {
    if (collection) {
      return { id: "collection", title: collection.title, collection, basePath: `/${segment}`, entrySlug: null };
    }

    if (pages.has(segment)) {
      return { id: "page", title: pages.frontmatter(segment)?.title ?? segment, slug: segment };
    }
  }

  if (segments.length === 2) {
    const entrySlug = segments[1]!;

    if (collection?.has(entrySlug)) {
      return {
        id: "collection",
        title: collection.frontmatter(entrySlug)?.title ?? entrySlug,
        collection,
        basePath: `/${segment}`,
        entrySlug,
      };
    }
  }

  return { id: "notFound", title: NOT_FOUND_TITLE };
}

/**
 * The route a window opens for `route`. A collection opens on its most recent entry,
 * so the collection window always has a body beside its list. An empty collection
 * (every entry a draft) has nothing to open, and keeps its own route.
 */
export function windowRouteFor(route: string): string {
  const target = resolveWindow(route);

  if (target?.id !== "collection" || target.entrySlug !== null) {
    return route;
  }

  const latest = target.collection.list()[0];

  return latest ? `${target.basePath}/${latest.slug}` : route;
}

/**
 * The route an open window traces back to on the desktop. A collection entry
 * traces back to its collection, so the folder it came from draws as open.
 */
export function desktopRouteOf(route: string): string {
  const target = resolveWindow(route);
  return target?.id === "collection" ? target.basePath : route;
}
