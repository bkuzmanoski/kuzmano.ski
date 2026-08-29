import { describe, expect, test } from "vitest";

import { feedDocument, feedEntry } from "../test-utils/feeds.ts";

import { atomFeed } from "./atom.ts";

import type { FeedEntry } from "./atom.ts";

const feed = (entries: Array<FeedEntry>) => atomFeed(feedDocument({ entries }));

describe("atomFeed", () => {
  test("widens calendar dates to RFC 3339 timestamps", () => {
    expect(feed([feedEntry()])).toContain("<published>2026-07-19T00:00:00Z</published>");
  });

  test("escapes markup in titles and entry content", () => {
    const xml = feed([feedEntry({ title: "Lorem & Ipsum", content: '<p class="className">Text.</p>' })]);

    expect(xml).toContain("<title>Lorem &amp; Ipsum</title>");
    expect(xml).toContain("&lt;p class=&quot;className&quot;&gt;Text.&lt;/p&gt;");
  });

  test("emits a category only when the entry has one", () => {
    expect(feed([feedEntry({ category: "Notes" })])).toContain('<category term="Notes"/>');
    expect(feed([feedEntry()])).not.toContain("<category");
  });

  test("declares the icon and logo images for the feed", () => {
    const xml = feed([]);

    expect(xml).toContain("<icon>https://kuzmano.ski/logo192.png</icon>");
    expect(xml).toContain("<logo>https://kuzmano.ski/logo512.png</logo>");
  });

  test("removes the characters XML does not allow", () => {
    const xml = feed([feedEntry({ title: `Lorem${String.fromCharCode(12)} Ipsum`, content: "\u0000<p>Text.</p>" })]);

    expect(xml).toContain("<title>Lorem Ipsum</title>");
    expect(xml).toContain("&lt;p&gt;Text.&lt;/p&gt;");
    // eslint-disable-next-line no-control-regex -- The control characters are the subject of the pattern.
    expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
  });

  test("writes a feed with no entries", () => {
    const xml = feed([]);

    expect(xml).toContain("<updated>2026-07-19T00:00:00Z</updated>");
    expect(xml).not.toContain("<entry>");
  });
});
