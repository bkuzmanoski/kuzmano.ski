import type { CollectionSegment } from "#/config/content.ts";
import type { FeedMetadata } from "#/config/site.ts";

import type { Feed, FeedEntry } from "../feeds/atom.ts";
import type { PageSource } from "../feeds/plugin.ts";

export const ENTRY_URL = "https://kuzmano.ski/collection/entry";

/** A prerendered page holding one article, as `articleContentOf` reads it off disk. */
export const articlePage = (article: string) =>
  `<html><body><main><article class="articleClass">${article}</article></main></body></html>`;

/** A page source that renders every route. */
export const pageSource: PageSource = (route) => Promise.resolve(articlePage(`<p>The body of ${route}.</p>`));

/** A page source with nothing prerendered, as the dev server has when a page fails to render. */
export const missingPageSource: PageSource = () => Promise.resolve(undefined);

/** One entry of a serialized feed. */
export const feedEntry = (overrides: Partial<FeedEntry> = {}): FeedEntry => ({
  title: "Entry Title",
  description: "Entry description.",
  url: ENTRY_URL,
  markdownUrl: `${ENTRY_URL}.md`,
  date: "2026-07-19",
  category: undefined,
  content: "<p>Content.</p>",
  ...overrides,
});

/** A feed ready to serialize, for suites covering the Atom document itself. */
export const feedDocument = (overrides: Partial<Feed> = {}): Feed => ({
  title: "Feed title",
  subtitle: "Feed subtitle.",
  author: "Author Name",
  icon: "https://kuzmano.ski/logo192.png",
  logo: "https://kuzmano.ski/logo512.png",
  url: "https://kuzmano.ski/collection",
  selfUrl: "https://kuzmano.ski/collection/feed.xml",
  updated: "2026-07-19",
  entries: [],
  ...overrides,
});

/**
 * A feed's declaration, for suites covering which entries a feed gathers.
 *
 * `collections` widens to plain strings so a suite can name collections of its own rather than the
 * segments the site happens to declare. A feed matches a segment against the scanned tree by name
 * and never looks it up, so a name outside the declared set behaves the same as one inside it.
 */
export const feedMetadata = ({
  collections = ["collection-1", "collection-2"],
  ...overrides
}: Partial<Omit<FeedMetadata, "collections">> & { collections?: Array<string> } = {}): FeedMetadata => ({
  title: "Feed title",
  description: "Feed subtitle.",
  path: "/feed.xml",
  route: "/",
  collections: collections as Array<CollectionSegment>,
  ...overrides,
});
