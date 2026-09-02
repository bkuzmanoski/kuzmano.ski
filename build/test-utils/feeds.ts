import type { CollectionSegment } from "#/config/content.ts";
import type { FeedMetadata } from "#/site/feeds.ts";

import type { Feed, FeedEntry } from "../feeds/atom.ts";
import type { PageSource } from "../feeds/plugin.ts";

export const ENTRY_URL = "https://kuzmano.ski/collection/entry";

export const articlePage = (article: string) =>
  `<html><body><main><article class="articleClass">${article}</article></main></body></html>`;

export const pageSource: PageSource = (route) => Promise.resolve(articlePage(`<p>The body of ${route}.</p>`));

export const missingPageSource: PageSource = () => Promise.resolve(undefined);

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
