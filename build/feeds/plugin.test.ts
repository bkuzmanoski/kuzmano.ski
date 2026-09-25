import { describe, expect, test, vi } from "vitest";

import { PAGES_DIRECTORY_NAME } from "#/config/content.ts";
import { FEED_CONTENT_TYPE } from "#/config/media-types.ts";
import { CONTENT_SIGNAL } from "#/config/site.ts";
import { FEEDS } from "#/site/feeds.ts";

import { CLIENT_ENVIRONMENT, SERVER_ENVIRONMENT } from "../environments.ts";
import {
  authoredCollection,
  authoredContent,
  authoredContentDirectory,
  authoredEntry,
  draftEntry,
} from "../test-utils/authored-content.ts";
import { articleDocument, documentSource, feedMetadata, missingDocumentSource } from "../test-utils/feeds.ts";
import { headersRulesAddedAtBuildStartBy } from "../test-utils/headers.ts";

import { feedXmlFor, feedsPlugin } from "./plugin.ts";

import type { AuthoredContent } from "../content/authored-content.ts";

const oneCollectionFeed = feedMetadata({ collections: ["collection-1"] });

const content = (overrides: Partial<AuthoredContent> = {}): AuthoredContent =>
  authoredContent({
    collections: [
      authoredCollection("collection-1", [authoredEntry("older-entry", { date: "2026-01-02" })]),
      authoredCollection("collection-2", [authoredEntry("newer-entry", { date: "2026-03-04" })]),
    ],
    ...overrides,
  });

describe("feedXmlFor", () => {
  test("includes every entry in the feed's collections, newest first", async () => {
    const xml = await feedXmlFor(feedMetadata(), content(), documentSource);

    expect(xml.indexOf("newer-entry")).toBeLessThan(xml.indexOf("older-entry"));
    expect(xml).toContain("The body of /collection-2/newer-entry.");
  });

  test("excludes an entry from a collection the feed does not list", async () => {
    const xml = await feedXmlFor(oneCollectionFeed, content(), documentSource);

    expect(xml).toContain("older-entry");
    expect(xml).not.toContain("newer-entry");
  });

  test("excludes a standalone page", async () => {
    const withPages = content({ pages: authoredContentDirectory(PAGES_DIRECTORY_NAME, [authoredEntry("about")]) });
    await expect(feedXmlFor(feedMetadata(), withPages, documentSource)).resolves.not.toContain("about");
  });

  test("excludes a draft entry", async () => {
    const withDraft = content({
      collections: [authoredCollection("collection-1", [draftEntry("unpublished", { date: "2026-09-09" })])],
    });
    await expect(feedXmlFor(oneCollectionFeed, withDraft, documentSource)).resolves.not.toContain("unpublished");
  });

  test("includes only the 20 newest entries", async () => {
    const manyEntries = Array.from({ length: 25 }, (_, index) =>
      authoredEntry(`entry-${index}`, { date: `2026-01-${String(index + 1).padStart(2, "0")}` }),
    );
    const xml = await feedXmlFor(
      oneCollectionFeed,
      content({ collections: [authoredCollection("collection-1", manyEntries)] }),
      documentSource,
    );

    expect(xml.match(/<entry>/g)).toHaveLength(20);
    expect(xml).toContain("entry-24"); // The newest.
    expect(xml).not.toContain("entry-4<"); // The oldest that did not fit.
  });

  test("outputs well-formed XML when an entry's content contains markup, quotes, and `]]>`", async () => {
    const hostileDocument = articleDocument(
      `<pre><code>if (a &lt; b &amp;&amp; c) { d[e[f]]&gt; }</code></pre><p>'Single' &amp; "double" quotes &lt;b&gt;.</p>`,
    );
    const xml = await feedXmlFor(feedMetadata(), content(), () => Promise.resolve(hostileDocument));
    const document = new DOMParser().parseFromString(xml, "text/xml");

    expect(document.querySelector("parsererror")).toBeNull();
    expect(document.querySelector("entry > content")?.textContent).toContain("]]>");
  });

  test("outputs an empty `<content>` when the document source does not return a document", async () => {
    await expect(feedXmlFor(feedMetadata(), content(), missingDocumentSource)).resolves.toContain(
      '<content type="html"/>',
    );
  });

  test("throws the document source's error when the document source rejects", async () => {
    const rejectingDocumentSource = () => Promise.reject(new Error("No prerendered document was captured.")); // Unlike a missing document, a rejection propagates, so a feed is not written with an empty entry.
    await expect(feedXmlFor(feedMetadata(), content(), rejectingDocumentSource)).rejects.toThrow(
      "No prerendered document was captured.",
    );
  });

  test("reads the document of each entry once across feeds built with the same article content cache", async () => {
    const countingDocumentSource = vi.fn(documentSource);
    const articleContents = new Map<string, Promise<string>>();

    await feedXmlFor(feedMetadata(), content(), countingDocumentSource, articleContents);
    const collectionFeedXml = await feedXmlFor(oneCollectionFeed, content(), countingDocumentSource, articleContents);

    expect(countingDocumentSource.mock.calls.map(([route]) => route)).toStrictEqual([
      "/collection-2/newer-entry",
      "/collection-1/older-entry",
    ]);
    expect(collectionFeedXml).toContain("The body of /collection-1/older-entry.");
  });

  test("outputs the newest entry's date as the feed's `<updated>` date", async () => {
    await expect(feedXmlFor(feedMetadata(), content(), documentSource)).resolves.toContain(
      "<updated>2026-03-04T00:00:00Z</updated>",
    );
  });

  test("outputs the Unix epoch as the feed's `<updated>` date when the feed has no entries", async () => {
    const contentWithoutFeedEntries = content({
      collections: [
        authoredCollection("collection-1"),
        authoredCollection("collection-2", [authoredEntry("newer-entry", { date: "2026-03-04" })]),
      ],
    });
    await expect(feedXmlFor(oneCollectionFeed, contentWithoutFeedEntries, documentSource)).resolves.toContain(
      "<updated>1970-01-01T00:00:00Z</updated>",
    );
  });
});

describe("feedsPlugin", () => {
  test("adds a `Content-Type` and `Content-Signal` rule for every feed path to `_headers` when the client build starts", () => {
    expect(headersRulesAddedAtBuildStartBy(feedsPlugin, CLIENT_ENVIRONMENT)).toStrictEqual([
      expect.objectContaining({
        pathPatterns: FEEDS.map(({ path }) => path),
        headers: { "Content-Type": FEED_CONTENT_TYPE, "Content-Signal": CONTENT_SIGNAL },
      }),
    ]);
  });

  test("adds rules to `_headers` from the client build only", () => {
    expect(headersRulesAddedAtBuildStartBy(feedsPlugin, SERVER_ENVIRONMENT)).toStrictEqual([]);
  });
});
