import { FEATURE_ROUTE_SPECS } from "#/config/feature-routes.ts";
import { isOneOf } from "#/lib/guards.ts";
import type { WindowId } from "#/lib/window-manager/window.ts";

import { collectionAlternateRepresentationsOf, entryAlternateRepresentationsOf } from "./alternate-representations.ts";
import { pages } from "./catalog.ts";
import { resolveContent } from "./resolve-content.ts";
import { FEATURE_ROUTE_IDS, isRootPath, parseContentPath } from "./routes.ts";

import type { AlternateRepresentations } from "./alternate-representations.ts";
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

export const isFeatureWindow = isOneOf(FEATURE_ROUTE_IDS);
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
      const featureRouteId = FEATURE_ROUTE_IDS.find((id) => FEATURE_ROUTE_SPECS[id].route === content.route);
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

export function windowAlternateRepresentationsOf(windowRoute: string): AlternateRepresentations | null {
  const windowTarget = resolveWindow(windowRoute);

  switch (windowTarget?.id) {
    case "entry":
      return entryAlternateRepresentationsOf({
        ...windowTarget,
        frontmatter: contentIndexOf(windowTarget).frontmatterOf(windowTarget.slug),
      });

    case "collection":
      return collectionAlternateRepresentationsOf(windowTarget.collection);

    default:
      return null;
  }
}
