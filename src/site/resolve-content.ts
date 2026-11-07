import type { FeatureRouteId } from "#/config/feature-routes.ts";

import { collections, pages } from "./catalog.ts";
import { featureRouteIdFor } from "./routes.ts";

import type { Collection, Frontmatter } from "./catalog.ts";

/** What a content path addresses. `notFound` means the catalog has no content for that segment and slug. */
export type ResolvedContent =
  | { kind: "page"; slug: string; frontmatter: Frontmatter | null }
  | { kind: "collectionEntry"; collection: Collection; slug: string; frontmatter: Frontmatter | null }
  | { kind: "collection"; collection: Collection }
  | { kind: "feature"; id: FeatureRouteId }
  | { kind: "notFound" };

/**
 * The content served at `/<segment>` or `/<segment>/<slug>`.
 *
 * The window resolver and the document loader both call this, so a route cannot open one window and describe another. A
 * feature route wins over content of the same name.
 */
export function resolveContent(segment: string, slug?: string): ResolvedContent {
  const collection = collections.get(segment);

  if (slug !== undefined) {
    return collection?.has(slug)
      ? { kind: "collectionEntry", collection, slug, frontmatter: collection.frontmatterOf(slug) }
      : { kind: "notFound" };
  }

  const featureRouteId = featureRouteIdFor(segment);

  if (featureRouteId) {
    return { kind: "feature", id: featureRouteId };
  }

  if (collection) {
    return { kind: "collection", collection };
  }

  return pages.has(segment)
    ? { kind: "page", slug: segment, frontmatter: pages.frontmatterOf(segment) }
    : { kind: "notFound" };
}
