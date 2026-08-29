import { describe, expect, test } from "vitest";

import { atomFeed } from "./atom.ts";

import type { FeedEntry } from "./atom.ts";

const entry = (overrides: Partial<FeedEntry> = {}): FeedEntry => ({
  title: "Entry Title",
  description: "Entry description.",
  url: "https://kuzmano.ski/collection/entry",
  markdownUrl: "https://kuzmano.ski/collection/entry.md",
  date: "2026-07-19",
  category: undefined,
  content: "<p>Content.</p>",
  ...overrides,
});

const feed = (entries: Array<FeedEntry>) =>
  atomFeed({
    title: "Feed title",
    subtitle: "Feed subtitle.",
    author: "Author Name",
    icon: "https://kuzmano.ski/logo192.png",
    logo: "https://kuzmano.ski/logo512.png",
    url: "https://kuzmano.ski/collection",
    selfUrl: "https://kuzmano.ski/collection/feed.xml",
    updated: "2026-07-19",
    entries,
  });

describe("atomFeed", () => {
  test("widens calendar dates to RFC 3339 timestamps", () => {
    expect(feed([entry()])).toContain("<published>2026-07-19T00:00:00Z</published>");
  });

  test("escapes markup in titles and entry content", () => {
    const xml = feed([entry({ title: "Lorem & Ipsum", content: '<p class="className">Text.</p>' })]);

    expect(xml).toContain("<title>Lorem &amp; Ipsum</title>");
    expect(xml).toContain("&lt;p class=&quot;className&quot;&gt;Text.&lt;/p&gt;");
  });

  test("emits a category only when the entry has one", () => {
    expect(feed([entry({ category: "Notes" })])).toContain('<category term="Notes"/>');
    expect(feed([entry()])).not.toContain("<category");
  });

  test("declares the icon and logo images for the feed", () => {
    const xml = feed([]);

    expect(xml).toContain("<icon>https://kuzmano.ski/logo192.png</icon>");
    expect(xml).toContain("<logo>https://kuzmano.ski/logo512.png</logo>");
  });

  test("writes a feed with no entries", () => {
    const xml = feed([]);

    expect(xml).toContain("<updated>2026-07-19T00:00:00Z</updated>");
    expect(xml).not.toContain("<entry>");
  });
});
