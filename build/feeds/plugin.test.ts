import { describe, expect, test } from "vitest";

import { feedMetadata, missingPageSource, pageSource } from "#/test-utils/feeds.ts";
import { draftEntry, scannedCollection, scannedContent, scannedEntry } from "#/test-utils/scanned-content.ts";

import { feedXmlFor } from "./plugin.ts";

import type { ScannedContent } from "../prerender/routes.ts";

const content = (overrides: Partial<ScannedContent> = {}): ScannedContent =>
  scannedContent({
    collections: [
      scannedCollection("work", [scannedEntry("a-project", { date: "2026-01-02" })]),
      scannedCollection("tech-notes", [scannedEntry("a-note", { date: "2026-03-04" })]),
    ],
    ...overrides,
  });

const workFeed = feedMetadata({ collections: ["work"] });

describe("feedXmlFor", () => {
  test("includes every entry in the feed's collections, newest first", async () => {
    const xml = await feedXmlFor(feedMetadata(), content(), pageSource);

    expect(xml.indexOf("a-note")).toBeLessThan(xml.indexOf("a-project"));
    expect(xml).toContain("&lt;p&gt;The body of /tech-notes/a-note.&lt;/p&gt;");
  });

  test("includes only the collections the feed names", async () => {
    const xml = await feedXmlFor(workFeed, content(), pageSource);

    expect(xml).toContain("a-project");
    expect(xml).not.toContain("a-note");
  });

  test("excludes standalone pages", async () => {
    const withPages = content({ pages: { entries: [scannedEntry("about")], subdirectories: [] } });
    await expect(feedXmlFor(feedMetadata(), withPages, pageSource)).resolves.not.toContain("about");
  });

  test("excludes drafts", async () => {
    const withDraft = content({
      collections: [scannedCollection("work", [draftEntry("unpublished", { date: "2026-09-09" })])],
    });
    await expect(feedXmlFor(workFeed, withDraft, pageSource)).resolves.not.toContain("unpublished");
  });

  test("limits the entries it includes to the most recent _n_", async () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      scannedEntry(`entry-${index}`, { date: `2026-01-${String(index + 1).padStart(2, "0")}` }),
    );
    const xml = await feedXmlFor(workFeed, content({ collections: [scannedCollection("work", many)] }), pageSource);

    expect(xml.match(/<entry>/g)).toHaveLength(20);
    expect(xml).toContain("entry-24"); // The newest.
    expect(xml).not.toContain("entry-4<"); // The oldest that did not fit.
  });

  test("reports the newest entry as the feed's date", async () => {
    await expect(feedXmlFor(feedMetadata(), content(), pageSource)).resolves.toContain(
      "<updated>2026-03-04T00:00:00Z</updated>",
    );
  });

  test("falls back to the site's newest date for a collection with nothing in it", async () => {
    const empty = content({
      collections: [
        scannedCollection("work"),
        scannedCollection("tech-notes", [scannedEntry("a-note", { date: "2026-03-04" })]),
      ],
    });

    await expect(feedXmlFor(workFeed, empty, pageSource)).resolves.toContain("<updated>2026-03-04T00:00:00Z</updated>");
  });

  test("reports a fixed date when the site has no published content, so a rebuild does not change the feed", async () => {
    const nothing = content({ collections: [scannedCollection("work")] });

    await expect(feedXmlFor(workFeed, nothing, pageSource)).resolves.toContain(
      "<updated>1970-01-01T00:00:00Z</updated>",
    );
  });

  test("writes an entry with no content when its page cannot be read", async () => {
    await expect(feedXmlFor(feedMetadata(), content(), missingPageSource)).resolves.toContain(
      '<content type="html"></content>',
    );
  });

  test("throws when the page source cannot be read, rather than publishing an empty entry", async () => {
    const rejects = () => Promise.reject(new Error("No prerendered page was captured."));
    await expect(feedXmlFor(feedMetadata(), content(), rejects)).rejects.toThrow("No prerendered page was captured.");
  });
});
