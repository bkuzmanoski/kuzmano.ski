import { markdownPath } from "#/lib/content/paths.ts";

import { collectionFeedOf } from "./feeds.ts";
import { hasMarkdownRepresentation } from "./markdown-negotiation.ts";
import { entryRouteOf } from "./routes.ts";

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

export function entryAlternateRepresentationsOf(entry: RepresentedEntry): AlternateRepresentations {
  return {
    markdownRepresentationPath: hasMarkdownRepresentation(entry.frontmatter) ? markdownPath(entryRouteOf(entry)) : null,
    feed: entry.collection && collectionFeedOf(entry.collection.route),
  };
}

export function collectionAlternateRepresentationsOf(collection: Collection): AlternateRepresentations {
  return {
    markdownRepresentationPath: markdownPath(collection.route),
    feed: collectionFeedOf(collection.route),
  };
}
