import { describe, expect, test } from "vitest";

import { isMarkdownPath, markdownRepresentationPathFor, prefersMarkdown } from "./markdown-negotiation.ts";

const BROWSER_ACCEPT_HEADER = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";

describe("prefersMarkdown", () => {
  test.each([
    ["names Markdown alone", "text/markdown"],
    ["names Markdown among types of equal quality", "text/markdown, text/html, */*"],
    ["gives Markdown a higher quality than HTML", "text/html;q=0.5, text/markdown;q=0.9"],
    ["surrounds its media range with spaces and capitalizes it", " Text/Markdown ; Q=1 "],
  ])("an `Accept` header that %s prefers Markdown", (_label, acceptHeader) => {
    expect(prefersMarkdown(acceptHeader)).toBe(true);
  });

  test.each([
    ["is the header a browser sends", BROWSER_ACCEPT_HEADER],
    ["accepts anything", "*/*"],
    ["accepts any text", "text/*"],
    ["gives HTML a higher quality than Markdown", "text/html, text/markdown;q=0.2"],
    ["gives Markdown a quality of `0`", "text/html, text/markdown;q=0"],
    ["names a type whose name ends with the Markdown media type", "application/text/markdown"],
  ])("an `Accept` header that %s does not prefer Markdown", (_label, acceptHeader) => {
    expect(prefersMarkdown(acceptHeader)).toBe(false);
  });

  test.each([
    ["an empty `Accept` header", ""],
    ["a `null` `Accept` header", null],
    ["an `undefined` `Accept` header", undefined],
  ])("%s does not prefer Markdown", (_label, acceptHeader) => {
    expect(prefersMarkdown(acceptHeader)).toBe(false);
  });
});

describe("markdownRepresentationPathFor", () => {
  test.each([
    ["a page", "/page", "/page.md"],
    ["a collection", "/collection", "/collection.md"],
    ["a collection entry", "/collection/entry", "/collection/entry.md"],
  ])("%s resolves to the path of its Markdown file", (_label, pathname, representationPath) => {
    expect(markdownRepresentationPathFor(pathname)).toBe(representationPath);
  });

  test.each([
    ["the site root", "/"],
    ["an empty path", ""],
    ["a Markdown file", "/page.md"],
    ["a feed", "/collection/feed.xml"],
    ["a media file", "/media/image.webp"],
    ["a path ending in a slash", "/collection/entry/"],
  ])("%s has no Markdown representation", (_label, pathname) => {
    expect(markdownRepresentationPathFor(pathname)).toBeNull();
  });
});

describe("isMarkdownPath", () => {
  test("a path ending in `.md` names a Markdown file", () => {
    expect(isMarkdownPath("/collection/entry.md")).toBe(true);
  });

  test("a document path does not name a Markdown file", () => {
    expect(isMarkdownPath("/collection/entry")).toBe(false);
  });
});
