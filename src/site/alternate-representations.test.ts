import { afterEach, describe, expect, test, vi } from "vitest";

import { configuredCollections } from "#/test-utils/catalog.ts";
import { fakeCollection, fakeCollectionEntries, fakeEntry } from "#/test-utils/collection.ts";

import { collectionAlternateRepresentationsOf, entryAlternateRepresentationsOf } from "./alternate-representations.ts";
import { collectionFeedOf } from "./feeds.ts";

const COLLECTION_WITH_FEED = Object.values(configuredCollections)[0]!;
const COLLECTION_WITH_FEED_ENTRY = COLLECTION_WITH_FEED.list()[0]!;
const COLLECTION_WITHOUT_FEED = fakeCollection(fakeCollectionEntries("entry"));

afterEach(() => vi.unstubAllEnvs());

describe("entryAlternateRepresentationsOf", () => {
  test("returns a page's Markdown representation path, and `null` for its feed", () => {
    expect(entryAlternateRepresentationsOf({ collection: null, slug: "page", frontmatter: fakeEntry("page") })).toEqual(
      { markdownRepresentationPath: "/page.md", feed: null },
    );
  });

  test("returns a collection entry's Markdown representation path and its collection's feed", () => {
    const { markdownRepresentationPath, feed } = entryAlternateRepresentationsOf({
      collection: COLLECTION_WITH_FEED,
      slug: COLLECTION_WITH_FEED_ENTRY.slug,
      frontmatter: COLLECTION_WITH_FEED_ENTRY,
    });

    expect(markdownRepresentationPath).toBe(`${COLLECTION_WITH_FEED.routeOf(COLLECTION_WITH_FEED_ENTRY.slug)}.md`);
    expect(feed).toBe(collectionFeedOf(COLLECTION_WITH_FEED.route));
  });

  test("returns `null` for the feed of an entry in a collection without a feed", () => {
    expect(
      entryAlternateRepresentationsOf({
        collection: COLLECTION_WITHOUT_FEED,
        slug: "entry",
        frontmatter: COLLECTION_WITHOUT_FEED.frontmatterOf("entry"),
      }).feed,
    ).toBeNull();
  });

  test("returns `null` for the Markdown representation path of a draft in production", () => {
    vi.stubEnv("DEV", false);

    const frontmatter = fakeEntry("draft-page", { draft: true });

    expect(
      entryAlternateRepresentationsOf({ collection: null, slug: "draft-page", frontmatter }).markdownRepresentationPath,
    ).toBeNull();
  });

  test("returns a draft's Markdown representation path in development", () => {
    vi.stubEnv("DEV", true);

    const frontmatter = fakeEntry("draft-page", { draft: true });

    expect(
      entryAlternateRepresentationsOf({ collection: null, slug: "draft-page", frontmatter }).markdownRepresentationPath,
    ).toBe("/draft-page.md");
  });
});

describe("collectionAlternateRepresentationsOf", () => {
  test("returns a collection's Markdown representation path and its feed", () => {
    const { markdownRepresentationPath, feed } = collectionAlternateRepresentationsOf(COLLECTION_WITH_FEED);

    expect(markdownRepresentationPath).toBe(`${COLLECTION_WITH_FEED.route}.md`);
    expect(feed).toBe(collectionFeedOf(COLLECTION_WITH_FEED.route));
  });

  test("returns `null` for the feed of a collection without a feed", () => {
    expect(collectionAlternateRepresentationsOf(COLLECTION_WITHOUT_FEED).feed).toBeNull();
  });
});
