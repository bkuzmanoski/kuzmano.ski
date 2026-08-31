import { COLLECTIONS } from "#/config/content";
import type { CollectionSegment } from "#/config/content";
import { SITE_DESCRIPTION, SITE_NAME } from "#/config/site";

export interface FeedMetadata {
  title: string;
  description: string;
  path: string;
  route: string; // The page the feed syndicates.
  collections: Array<CollectionSegment>; // The collections whose entries the feed carries.
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
  path: `/${segment}/feed.xml`,
  route: `/${segment}`,
  collections: [segment as CollectionSegment],
}));

/** The feed carrying a collection's entries. Returns nothing for a segment that is not a collection. */
export const collectionFeed = (segment: string): FeedMetadata | undefined =>
  COLLECTION_FEEDS.find((feed) => feed.route === `/${segment}`);

/** Every feed the site publishes. */
export const FEEDS: Array<FeedMetadata> = [SITE_FEED, ...COLLECTION_FEEDS];
