import { describe, expect, test } from "vitest";

import { ENTRY_URL, articleDocument } from "../test-utils/feeds.ts";

import { articleContentOf } from "./article.ts";

describe("articleContentOf", () => {
  test("returns the article's body", () => {
    expect(articleContentOf(articleDocument("<p>A body.</p>"), ENTRY_URL)).toBe("<p>A body.</p>");
  });

  test("resolves the URLs of links and images against the entry's URL", () => {
    const body = articleContentOf(
      articleDocument('<a href="/collection">Link 1</a><img src="/image.png"><a href="#section">Link 2</a>'),
      ENTRY_URL,
    );

    expect(body).toContain('href="https://kuzmano.ski/collection"');
    expect(body).toContain('src="https://kuzmano.ski/image.png"');
    expect(body).toContain(`href="${ENTRY_URL}#section"`);
  });

  test("omits the `class` and `style` attributes", () => {
    const body = articleContentOf(articleDocument('<p class="_p_1a2b" style="color:var(--x)">A body.</p>'), ENTRY_URL);
    expect(body).toBe("<p>A body.</p>");
  });

  test("removes controls and icons along with their labels", () => {
    const body = articleContentOf(
      articleDocument('<p>A body.</p><button><svg><path d="M0"/></svg>Copy</button>'),
      ENTRY_URL,
    );
    expect(body).toBe("<p>A body.</p>");
  });

  test("removes every `<script>` and `<style>`", () => {
    const body = articleContentOf(
      articleDocument("<style>p{color:red}</style><script>alert(1);</script><p>A body.</p>"),
      ENTRY_URL,
    );
    expect(body).toBe("<p>A body.</p>");
  });

  test("removes heading links and the elements left empty by their removal", () => {
    const heading =
      '<h2 id="section">A Heading<span class="wrapper"><a data-heading-link href="#section"><span>#</span></a></span></h2>';
    expect(articleContentOf(articleDocument(heading), ENTRY_URL)).toBe('<h2 id="section">A Heading</h2>');
  });

  test("removes an element that has a `data-feed-omit` attribute", () => {
    const body = articleContentOf(articleDocument("<p>A body.</p><div data-feed-omit><p>UI</p></div>"), ENTRY_URL);
    expect(body).toBe("<p>A body.</p>");
  });

  test("replaces an element that has a `data-feed-text` attribute with a paragraph containing the attribute's value", () => {
    const body = articleContentOf(
      articleDocument(
        `<p>A body.</p><aside data-feed-text="Join the waitlist at ${ENTRY_URL}"><form><input></form></aside>`,
      ),
      ENTRY_URL,
    );

    expect(body).toBe(`<p>A body.</p><p>Join the waitlist at ${ENTRY_URL}</p>`);
  });

  test("unwraps every `<span>` left without attributes by sanitizing, preserving a code block's line breaks", () => {
    const code =
      '<pre><code><span class="line"><span style="color:red">token</span></span>\n<span class="line"></span>\ntoken</code></pre>';
    expect(articleContentOf(articleDocument(code), ENTRY_URL)).toBe("<pre><code>token\n\ntoken</code></pre>");
  });

  test("resolves the candidate URLs in a `srcset` attribute, preserving their descriptors", () => {
    const body = articleContentOf(
      articleDocument(
        '<picture><source srcset="/image-1.avif 1x, /image-2.avif 2x"><img src="/image-1.png" alt="A"></picture>',
      ),
      ENTRY_URL,
    );

    expect(body).toContain('srcset="https://kuzmano.ski/image-1.avif 1x, https://kuzmano.ski/image-2.avif 2x"');
    expect(body).toContain('src="https://kuzmano.ski/image-1.png"');
  });

  test("preserves a `<video>`, resolving its `src` and `poster` attributes", () => {
    const body = articleContentOf(
      articleDocument('<video src="/video.mp4" poster="/video-poster.png" controls></video>'),
      ENTRY_URL,
    );

    expect(body).toContain('src="https://kuzmano.ski/video.mp4"');
    expect(body).toContain('poster="https://kuzmano.ski/video-poster.png"');
  });

  test("unwraps a `<div>` left without attributes by sanitizing", () => {
    const body = articleContentOf(articleDocument('<div class="_container_1a2b"><p>A body.</p></div>'), ENTRY_URL);
    expect(body).toBe("<p>A body.</p>");
  });

  test("throws when the document does not contain exactly one `<article>`", () => {
    expect(() => articleContentOf("<html><body></body></html>", ENTRY_URL)).toThrow("found 0");
    expect(() =>
      articleContentOf(articleDocument("<p>Paragraph 1.</p>") + articleDocument("<p>Paragraph 2.</p>"), ENTRY_URL),
    ).toThrow("found 2");
  });
});
