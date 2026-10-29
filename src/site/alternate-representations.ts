import { markdownPath } from "#/lib/content/paths.ts";

import { collectionFeedOf } from "./feeds.ts";
import { hasMarkdownRepresentation } from "./markdown-negotiation.ts";
import { pageRoute } from "./routes.ts";

import type { Collection, Frontmatter } from "./catalog.ts";
import type { FeedMetadata } from "./feeds.ts";

export interface AlternateRepresentations {
  markdownRepresentationPath: string | null;
  feed: FeedMetadata | null;
}

/** A page, with a `collection` of `null`, or a collection entry. */
interface RepresentedEntry {
  collection: Collection | null;
  slug: string;
  frontmatter: Frontmatter | null;
}

export function entryAlternateRepresentationsOf({
  collection,
  slug,
  frontmatter,
}: RepresentedEntry): AlternateRepresentations {
  return {
    markdownRepresentationPath: hasMarkdownRepresentation(frontmatter)
      ? markdownPath(collection ? collection.routeOf(slug) : pageRoute(slug))
      : null,
    feed: collection && collectionFeedOf(collection.route),
  };
}

export function collectionAlternateRepresentationsOf(collection: Collection): AlternateRepresentations {
  return {
    markdownRepresentationPath: markdownPath(collection.route),
    feed: collectionFeedOf(collection.route),
  };
}
