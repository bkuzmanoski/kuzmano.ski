import { describe, expect, test } from "vitest";

import { SITE_URL } from "#/config/site.ts";

import { ENTRY_URL, feedDocument, feedEntry } from "../test-utils/feeds.ts";

import { atomFeed } from "./atom.ts";

import type { FeedEntry } from "./atom.ts";

const NULL = String.fromCharCode(0);
const FORM_FEED = String.fromCharCode(12);
const LONE_SURROGATE = String.fromCharCode(0xd800);
const EMOJI = "\u{1F5FA}\u{FE0F}"; // A surrogate pair followed by a variation selector.

const feed = (entries: Array<FeedEntry>) => atomFeed(feedDocument({ entries }));

// A feed is read by an XML parser, so the assertions below read it back through one
// rather than matching the character references the serializer happens to emit.
const parseXml = (xml: string) => {
  const document = new DOMParser().parseFromString(xml, "text/xml");

  expect(document.querySelector("parsererror")).toBeNull();

  return document;
};

describe("atomFeed", () => {
  test("declares the XML version and encoding before the `<feed>`", () => {
    expect(feed([])).toMatch(/^<\?xml version="1\.0" encoding="utf-8"\?><feed /);
  });

  test("converts calendar dates to RFC 3339 timestamps", () => {
    expect(feed([feedEntry()])).toContain("<published>2026-07-19T00:00:00Z</published>");
  });

  test("timestamps each calendar date at midnight in the feed's time zone", () => {
    const xml = atomFeed(
      feedDocument({
        timeZone: "Australia/Sydney",
        updated: "2026-10-04",
        entries: [feedEntry({ date: "2026-01-15" })],
      }),
    );

    expect(xml).toContain("<updated>2026-10-04T00:00:00+10:00</updated>");
    expect(xml).toContain("<published>2026-01-15T00:00:00+11:00</published>");
    expect(xml).toContain("<updated>2026-01-15T00:00:00+11:00</updated>");
  });

  test("emits the feed's author with their name and URL", () => {
    const document = parseXml(feed([]));

    expect(document.querySelector("feed > author > name")?.textContent).toBe("Author Name");
    expect(document.querySelector("feed > author > uri")?.textContent).toBe(`${SITE_URL}/`);
  });

  test("emits a subtitle only when the feed has one", () => {
    expect(feed([])).toContain("<subtitle>Feed subtitle.</subtitle>");
    expect(atomFeed(feedDocument({ subtitle: "" }))).not.toContain("<subtitle");
  });

  test("escapes the markup and quotes in a title", () => {
    const title = "A & B <C> \"D\" 'E'";
    expect(parseXml(feed([feedEntry({ title })])).querySelector("entry > title")?.textContent).toBe(title);
  });

  test("escapes an entry's content into a text node rather than nesting it as markup", () => {
    const content = '<p class="className">A &amp; B.</p>';
    const xml = feed([feedEntry({ content })]);
    const element = parseXml(xml).querySelector("entry > content");

    expect(element?.getAttribute("type")).toBe("html");
    expect(element?.textContent).toBe(content);
    expect(element?.children).toHaveLength(0);
    expect(xml).not.toContain("<![CDATA["); // A CDATA section round-trips as the same text, but changes the bytes a feed reader receives.
  });

  test("escapes the `]]>` that XML does not allow in character data", () => {
    const content = "<pre><code>a ]]> b</code></pre>";
    expect(parseXml(feed([feedEntry({ content })])).querySelector("entry > content")?.textContent).toBe(content);
  });

  test("emits a category only when the entry has one", () => {
    expect(feed([feedEntry({ category: "Category" })])).toContain('<category term="Category"/>');
    expect(feed([feedEntry()])).not.toContain("<category");
  });

  test("declares the icon and logo images for the feed", () => {
    const xml = feed([]);

    expect(xml).toContain(`<icon>${SITE_URL}/logo192.png</icon>`);
    expect(xml).toContain(`<logo>${SITE_URL}/logo512.png</logo>`);
  });

  test("removes the control characters and lone surrogates XML cannot represent", () => {
    const document = parseXml(
      feed([
        feedEntry({
          title: `A${FORM_FEED} title`,
          content: `${NULL}<p>Te${LONE_SURROGATE}xt.</p>`,
        }),
      ]),
    );

    expect(document.querySelector("entry > title")?.textContent).toBe("A title");
    expect(document.querySelector("entry > content")?.textContent).toBe("<p>Text.</p>");
  });

  test("preserves an emoji authored as a surrogate pair in every field of an entry", () => {
    const document = parseXml(
      feed([
        feedEntry({
          title: `A ${EMOJI} title`,
          description: `A ${EMOJI} summary.`,
          category: `Category ${EMOJI}`,
          content: `<p>${EMOJI}</p>`,
        }),
      ]),
    );

    expect(document.querySelector("entry > title")?.textContent).toBe(`A ${EMOJI} title`);
    expect(document.querySelector("entry > summary")?.textContent).toBe(`A ${EMOJI} summary.`);
    expect(document.querySelector("entry > category")?.getAttribute("term")).toBe(`Category ${EMOJI}`);
    expect(document.querySelector("entry > content")?.textContent).toBe(`<p>${EMOJI}</p>`);
  });

  test("emits well-formed XML when every field contains markup, quotes, `]]>`, control characters, and a lone surrogate", () => {
    const hostileText = `& < > " ' ]]> ${NULL}${FORM_FEED}${LONE_SURROGATE} <b onclick="x">`;
    const document = parseXml(
      atomFeed(
        feedDocument({
          title: hostileText,
          subtitle: hostileText,
          author: hostileText,
          entries: [
            feedEntry({
              title: hostileText,
              description: hostileText,
              category: hostileText,
              url: `${ENTRY_URL}?a=1&b=2`,
              content: `<p class="c">${hostileText}</p><![CDATA[raw]]>`,
            }),
          ],
        }),
      ),
    );

    expect(document.querySelector("feed > title")?.textContent).toContain("& < > \" ' ]]>");
    expect(document.querySelector("entry > content")?.textContent).toContain("]]>");
    expect(document.querySelector("entry > content")?.children).toHaveLength(0);
  });

  test("emits a feed without entries", () => {
    const xml = feed([]);

    expect(xml).toContain("<updated>2026-07-19T00:00:00Z</updated>");
    expect(xml).not.toContain("<entry>");
  });
});
