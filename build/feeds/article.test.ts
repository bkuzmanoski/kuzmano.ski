import { describe, expect, test } from "vitest";

import { ENTRY_URL, articlePage } from "../test-utils/feeds.ts";

import { articleContentOf } from "./article.ts";

describe("articleContentOf", () => {
  test("returns the article's body", () => {
    expect(articleContentOf(articlePage("<p>A body.</p>"), ENTRY_URL)).toBe("<p>A body.</p>");
  });

  test("resolves links and images against the entry", () => {
    const body = articleContentOf(
      articlePage('<a href="/collection">Link 1</a><img src="/image.png"><a href="#section">Link 2</a>'),
      ENTRY_URL,
    );

    expect(body).toContain('href="https://kuzmano.ski/collection"');
    expect(body).toContain('src="https://kuzmano.ski/image.png"');
    expect(body).toContain(`href="${ENTRY_URL}#section"`);
  });

  test("drops the classes and inline styles the page renders with", () => {
    const body = articleContentOf(articlePage('<p class="_p_1a2b" style="color:var(--x)">A body.</p>'), ENTRY_URL);
    expect(body).toBe("<p>A body.</p>");
  });

  test("removes controls and icons along with their labels", () => {
    const body = articleContentOf(
      articlePage('<p>A body.</p><button><svg><path d="M0"/></svg>Copy</button>'),
      ENTRY_URL,
    );
    expect(body).toBe("<p>A body.</p>");
  });

  test("removes scripts and style elements", () => {
    const body = articleContentOf(
      articlePage("<style>p{color:red}</style><script>alert(1);</script><p>A body.</p>"),
      ENTRY_URL,
    );
    expect(body).toBe("<p>A body.</p>");
  });

  test("removes heading links and the elements left empty by their removal", () => {
    const heading =
      '<h1 id="section">A Heading<span class="wrapper"><a data-heading-link href="#section"><span>#</span></a></span></h1>';
    expect(articleContentOf(articlePage(heading), ENTRY_URL)).toBe('<h1 id="section">A Heading</h1>');
  });

  test("removes anything a component has marked as UI", () => {
    const body = articleContentOf(articlePage("<p>A body.</p><div data-feed-omit><p>UI</p></div>"), ENTRY_URL);
    expect(body).toBe("<p>A body.</p>");
  });

  test("replaces an element with a paragraph containing text supplied by the component", () => {
    const body = articleContentOf(
      articlePage(
        `<p>A body.</p><aside data-feed-text="Join the waitlist at ${ENTRY_URL}"><form><input></form></aside>`,
      ),
      ENTRY_URL,
    );

    expect(body).toBe(`<p>A body.</p><p>Join the waitlist at ${ENTRY_URL}</p>`);
  });

  test("unwraps the spans left bare by sanitizing, keeping a code block's shape", () => {
    const code =
      '<pre><code><span class="line"><span style="color:red">token</span></span>\n<span class="line"></span>\ntoken</code></pre>';
    expect(articleContentOf(articlePage(code), ENTRY_URL)).toBe("<pre><code>token\n\ntoken</code></pre>");
  });

  test("resolves a srcset's candidates, keeping their descriptors", () => {
    const body = articleContentOf(
      articlePage(
        '<picture><source srcset="/image-1.avif 1x, /image-2.avif 2x"><img src="/image-1.png" alt="A"></picture>',
      ),
      ENTRY_URL,
    );

    expect(body).toContain('srcset="https://kuzmano.ski/image-1.avif 1x, https://kuzmano.ski/image-2.avif 2x"');
    expect(body).toContain('src="https://kuzmano.ski/image-1.png"');
  });

  test("keeps a video embed, resolving the poster it is shown behind", () => {
    const body = articleContentOf(
      articlePage('<video src="/video.mp4" poster="/video-poster.png" controls></video>'),
      ENTRY_URL,
    );

    expect(body).toContain('src="https://kuzmano.ski/video.mp4"');
    expect(body).toContain('poster="https://kuzmano.ski/video-poster.png"');
  });

  test("unwraps the layout a component wraps its content in", () => {
    const body = articleContentOf(articlePage('<div class="_container_1a2b"><p>A body.</p></div>'), ENTRY_URL);
    expect(body).toBe("<p>A body.</p>");
  });

  test("throws when the page does not hold exactly one article", () => {
    expect(() => articleContentOf("<html><body></body></html>", ENTRY_URL)).toThrow("found 0");
    expect(() =>
      articleContentOf(articlePage("<p>Paragraph 1.</p>") + articlePage("<p>Paragraph 2.</p>"), ENTRY_URL),
    ).toThrow("found 2");
  });
});
