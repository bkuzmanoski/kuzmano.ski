import { describe, expect, test } from "vitest";

import { documentSource, feedMetadata, missingDocumentSource } from "../test-utils/feeds.ts";
import { draftEntry, scannedCollection, scannedContent, scannedEntry } from "../test-utils/scanned-content.ts";

import { feedXmlFor } from "./plugin.ts";

import type { ScannedContent } from "../prerender/routes.ts";

const content = (overrides: Partial<ScannedContent> = {}): ScannedContent =>
  scannedContent({
    collections: [
      scannedCollection("collection-1", [scannedEntry("older-entry", { date: "2026-01-02" })]),
      scannedCollection("collection-2", [scannedEntry("newer-entry", { date: "2026-03-04" })]),
    ],
    ...overrides,
  });

const oneCollectionFeed = feedMetadata({ collections: ["collection-1"] });

describe("feedXmlFor", () => {
  test("includes every entry in the feed's collections, newest first", async () => {
    const xml = await feedXmlFor(feedMetadata(), content(), documentSource);

    expect(xml.indexOf("newer-entry")).toBeLessThan(xml.indexOf("older-entry"));
    expect(xml).toContain("&lt;p&gt;The body of /collection-2/newer-entry.&lt;/p&gt;");
  });

  test("includes only the collections the feed names", async () => {
    const xml = await feedXmlFor(oneCollectionFeed, content(), documentSource);

    expect(xml).toContain("older-entry");
    expect(xml).not.toContain("newer-entry");
  });

  test("excludes standalone pages", async () => {
    const withPages = content({ pages: { entries: [scannedEntry("about")], subdirectories: [] } });
    await expect(feedXmlFor(feedMetadata(), withPages, documentSource)).resolves.not.toContain("about");
  });

  test("excludes drafts", async () => {
    const withDraft = content({
      collections: [scannedCollection("collection-1", [draftEntry("unpublished", { date: "2026-09-09" })])],
    });
    await expect(feedXmlFor(oneCollectionFeed, withDraft, documentSource)).resolves.not.toContain("unpublished");
  });

  test("limits the entries it includes to the most recent _n_", async () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      scannedEntry(`entry-${index}`, { date: `2026-01-${String(index + 1).padStart(2, "0")}` }),
    );
    const xml = await feedXmlFor(
      oneCollectionFeed,
      content({ collections: [scannedCollection("collection-1", many)] }),
      documentSource,
    );

    expect(xml.match(/<entry>/g)).toHaveLength(20);
    expect(xml).toContain("entry-24"); // The newest.
    expect(xml).not.toContain("entry-4<"); // The oldest that did not fit.
  });

  test("reports the newest entry as the feed's date", async () => {
    await expect(feedXmlFor(feedMetadata(), content(), documentSource)).resolves.toContain(
      "<updated>2026-03-04T00:00:00Z</updated>",
    );
  });

  test("falls back to the site's newest date for an empty collection", async () => {
    const empty = content({
      collections: [
        scannedCollection("collection-1"),
        scannedCollection("collection-2", [scannedEntry("newer-entry", { date: "2026-03-04" })]),
      ],
    });

    await expect(feedXmlFor(oneCollectionFeed, empty, documentSource)).resolves.toContain(
      "<updated>2026-03-04T00:00:00Z</updated>",
    );
  });

  test("reports a fixed date when the site has no published content, so a rebuild does not change the feed", async () => {
    const nothing = content({ collections: [scannedCollection("collection-1")] });

    await expect(feedXmlFor(oneCollectionFeed, nothing, documentSource)).resolves.toContain(
      "<updated>1970-01-01T00:00:00Z</updated>",
    );
  });

  test("writes an entry with no content when its document cannot be read", async () => {
    await expect(feedXmlFor(feedMetadata(), content(), missingDocumentSource)).resolves.toContain(
      '<content type="html"></content>',
    );
  });

  test("throws when the document source cannot be read, rather than publishing an empty entry", async () => {
    const rejects = () => Promise.reject(new Error("No prerendered document was captured."));
    await expect(feedXmlFor(feedMetadata(), content(), rejects)).rejects.toThrow(
      "No prerendered document was captured.",
    );
  });
});
