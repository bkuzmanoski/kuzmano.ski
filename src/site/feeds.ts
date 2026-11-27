// Imports only leaf modules because `/vite.config.ts` loads this module through `/build`.
import { COLLECTIONS } from "#/config/content.ts";
import type { CollectionSegment } from "#/config/content.ts";
import { SITE_DESCRIPTION, SITE_NAME } from "#/config/site.ts";

import { collectionRoute } from "./routes.ts";

/** File name used for each published feed at the root of its route. */
export const FEED_FILE_NAME = "feed.xml";

export interface FeedMetadata {
  title: string;
  description: string;
  path: string;
  /** Route syndicated by this feed. */
  route: string;
  collections: Array<CollectionSegment>;
}

export const SITE_FEED: FeedMetadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  path: `/${FEED_FILE_NAME}`,
  route: "/",
  collections: Object.keys(COLLECTIONS) as Array<CollectionSegment>,
};

const COLLECTION_FEEDS: Array<FeedMetadata> = Object.entries(COLLECTIONS).map(([segment, { title, description }]) => ({
  title: `${SITE_NAME}: ${title}`,
  description,
  path: `${collectionRoute(segment)}/${FEED_FILE_NAME}`,
  route: collectionRoute(segment),
  collections: [segment as CollectionSegment],
}));

/** Returns the feed for the collection at `route`, or `null` if `route` is not a collection. */
export const collectionFeedOf = (route: string): FeedMetadata | null =>
  COLLECTION_FEEDS.find((feed) => feed.route === route) ?? null;

/** Every feed the site publishes. */
export const FEEDS: Array<FeedMetadata> = [SITE_FEED, ...COLLECTION_FEEDS];
