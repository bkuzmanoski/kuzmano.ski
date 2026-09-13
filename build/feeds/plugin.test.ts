import { describe, expect, test } from "vitest";

import { PAGES_DIRECTORY_NAME } from "#/config/content.ts";

import {
  authoredCollection,
  authoredContent,
  authoredContentDirectory,
  authoredEntry,
  draftEntry,
} from "../test-utils/authored-content.ts";
import { articleDocument, documentSource, feedMetadata, missingDocumentSource } from "../test-utils/feeds.ts";

import { feedXmlFor } from "./plugin.ts";

import type { AuthoredContent } from "../content/authored-content.ts";

const content = (overrides: Partial<AuthoredContent> = {}): AuthoredContent =>
  authoredContent({
    collections: [
      authoredCollection("collection-1", [authoredEntry("older-entry", { date: "2026-01-02" })]),
      authoredCollection("collection-2", [authoredEntry("newer-entry", { date: "2026-03-04" })]),
    ],
    ...overrides,
  });

const oneCollectionFeed = feedMetadata({ collections: ["collection-1"] });

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
