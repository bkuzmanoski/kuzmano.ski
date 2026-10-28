import { FEATURE_ROUTE_SPECS } from "#/config/feature-routes.ts";
import type { FeatureRouteId } from "#/config/feature-routes.ts";
import type { WindowId } from "#/lib/window-manager/window.ts";

import { pages } from "./catalog.ts";
import { resolveContent } from "./resolve-content.ts";
import { isRootPath, parseContentPath } from "./routes.ts";

import type { Collection, ContentIndex } from "./catalog.ts";
import type { ResolvedContent } from "./resolve-content.ts";

type WindowTarget = {
  [K in WindowId]: { id: K; title: string } & {
    entry: { slug: string } & ({ collection: null } | { collection: Collection });
    collection: { collection: Collection };
    contact: Record<never, never>;
    controlPanel: Record<never, never>;
  }[K];
}[WindowId];

export type EntryTarget = Extract<WindowTarget, { id: "entry" }>;
export type CollectionEntryTarget = Extract<EntryTarget, { collection: Collection }>;
export type CollectionTarget = Extract<WindowTarget, { id: "collection" }>;
export type ResolvedRoute = WindowTarget | { id: "desktop" } | { id: "notFound" };

export const contentIndexOf = (entry: EntryTarget): ContentIndex => entry.collection ?? pages;

export function resolveRoute(route: string): ResolvedRoute {
  if (isRootPath(route)) {
    return { id: "desktop" };
  }

  const contentPath = parseContentPath(route);
  const content: ResolvedContent = contentPath
    ? resolveContent(contentPath.segment, contentPath.slug)
    : { kind: "notFound" };

  switch (content.kind) {
    case "page":
      return {
        id: "entry",
        title: content.frontmatter?.title ?? content.slug,
        slug: content.slug,
        collection: null,
      };

    case "collectionEntry":
      return {
        id: "entry",
        title: content.frontmatter?.title ?? content.slug,
        slug: content.slug,
        collection: content.collection,
      };

    case "collection":
      return {
        id: "collection",
        title: content.collection.title,
        collection: content.collection,
      };

    case "feature": {
      const featureRouteId = (Object.keys(FEATURE_ROUTE_SPECS) as Array<FeatureRouteId>).find(
        (id) => FEATURE_ROUTE_SPECS[id].route === content.route,
      );

      return featureRouteId
        ? { id: featureRouteId, title: FEATURE_ROUTE_SPECS[featureRouteId].title }
        : { id: "notFound" };
    }

    default:
      return { id: "notFound" };
  }
}

export function resolveWindow(route: string): WindowTarget | null {
  const resolvedRoute = resolveRoute(route);
  return resolvedRoute.id === "desktop" || resolvedRoute.id === "notFound" ? null : resolvedRoute;
}

function destinationShownBy(windowRoute: string): string | null {
  const windowTarget = resolveWindow(windowRoute);

  switch (windowTarget?.id) {
    case "entry":
    case "contact":
    case "controlPanel":
      return windowRoute;

    case "collection":
      return windowTarget.collection.route;

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
