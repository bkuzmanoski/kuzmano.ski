import { COLLECTIONS } from "#/config/content.ts";
import type { CollectionSegment } from "#/config/content.ts";
import { SITE_DESCRIPTION, SITE_NAME } from "#/config/site.ts";

import { collectionRoute } from "./content-routes.ts";

export interface FeedMetadata {
  title: string;
  description: string;
  path: string;
  route: string; // The route whose content the feed syndicates.
  collections: Array<CollectionSegment>;
}

/** The feed for the site as a whole. */
export const SITE_FEED: FeedMetadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  path: "/feed.xml",
  route: "/",
  collections: Object.keys(COLLECTIONS) as Array<CollectionSegment>,
};

const COLLECTION_FEEDS: Array<FeedMetadata> = Object.entries(COLLECTIONS).map(([segment, { title, description }]) => ({
  title: `${SITE_NAME}: ${title}`,
  description,
  path: `${collectionRoute(segment)}/feed.xml`,
  route: collectionRoute(segment),
  collections: [segment as CollectionSegment],
}));

/** The feed carrying a collection's entries. Returns nothing for a segment that is not a collection. */
export const collectionFeed = (segment: string): FeedMetadata | undefined =>
  COLLECTION_FEEDS.find((feed) => feed.route === collectionRoute(segment));

/** Every feed the site publishes. */
export const FEEDS: Array<FeedMetadata> = [SITE_FEED, ...COLLECTION_FEEDS];
