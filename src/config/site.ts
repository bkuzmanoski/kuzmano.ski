import { COLLECTIONS } from "#/config/content";
import type { CollectionSegment } from "#/config/content";

export const SITE_NAME = "Brian Kuzmanoski";
export const SITE_URL = "https://kuzmano.ski";
export const SITE_DESCRIPTION = "The personal site of Brian Kuzmanoski: work, notes and experience.";
export const SITE_SOURCE_URL = "https://github.com/bkuzmanoski/kuzmano.ski";
export const NOT_FOUND_PAGE_TITLE = "Page not found (404)";
export const FEED_TYPE = "application/atom+xml";
export const FEED_MAX_ENTRIES = 20;
export const FEED_ICON = "/logo192.png";
export const FEED_LOGO = "/logo512.png";

const SOCIAL_IMAGE = "/logo512.png";

export interface FeedLink {
  title: string;
  path: string;
}

export interface DocumentMetadata {
  title: string; // The page's own title, without the site suffix `documentTitle` adds.
  description: string;
  path: string; // The route's path, from "/" down. Becomes the canonical URL.
  kind?: "website" | "article"; // Open Graph type. Dated, authored pages are "article"; everything else is "website".
  contentAsset?: string | null; // URL of the chunk holding the page's compiled content, preloaded so it is available to hydration (see `/build/content-assets.ts`).
  markdown?: boolean; // Whether the page has a markdown alternate to advertise (see `/build/markdown.ts`).
  feed?: FeedLink; // The feed carrying this page's entries.
}

export interface FeedMetadata {
  title: string;
  description: string;
  path: string;
  route: string; // The page the feed syndicates.
  collections: Array<CollectionSegment>; // The collections whose entries the feed carries.
}

export const documentTitle = (title: string) => `${title}—${SITE_NAME}`;
export const canonicalUrl = (path: string) => `${SITE_URL}${path}`;
export const markdownPath = (path: string) => `${path}.md`;
export const markdownUrl = (path: string) => canonicalUrl(markdownPath(path));

/**
 * The head tags for a page.
 *
 * `HeadContent` keys meta tags on `name ?? property` and lets the deepest match win, so a
 * route overrides a tag from the root by re-declaring it under the same key.
 */
export function documentHead({
  title,
  description,
  path,
  kind = "website",
  contentAsset,
  markdown,
  feed,
}: DocumentMetadata) {
  const url = canonicalUrl(path);
  const fullTitle = path === "/" ? SITE_NAME : documentTitle(title);

  return {
    meta: [
      { title: fullTitle },
      { name: "description", content: description },
      { property: "og:type", content: kind },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: canonicalUrl(SOCIAL_IMAGE) },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "canonical", href: url },
      ...(contentAsset ? [{ rel: "modulepreload", href: contentAsset }] : []),
      ...(markdown ? [{ rel: "alternate", type: "text/markdown", href: markdownUrl(path), title: "Markdown" }] : []),
      ...(feed ? [{ rel: "alternate", type: FEED_TYPE, href: feed.path, title: feed.title }] : []),
    ],
  };
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
