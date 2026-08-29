import { describe, expect, test } from "vitest";

import { articleContentOf } from "./article.ts";

const URL = "https://kuzmano.ski/collection/entry";
const page = (article: string) =>
  `<html><body><main><article class="articleClass">${article}</article></main></body></html>`;

describe("articleContentOf", () => {
  test("returns the article's body", () => {
    expect(articleContentOf(page("<p>A body.</p>"), URL)).toBe("<p>A body.</p>");
  });

  test("resolves links and images against the entry", () => {
    const body = articleContentOf(
      page('<a href="/collection">Link 1</a><img src="/image.png"><a href="#section">Link 2</a>'),
      URL,
    );

    expect(body).toContain('href="https://kuzmano.ski/collection"');
    expect(body).toContain('src="https://kuzmano.ski/image.png"');
    expect(body).toContain(`href="${URL}#section"`);
  });

  test("drops the classes and inline styles the page renders with", () => {
    const body = articleContentOf(page('<p class="_p_1a2b" style="color:var(--x)">A body.</p>'), URL);
    expect(body).toBe("<p>A body.</p>");
  });

  test("removes controls and icons along with their labels", () => {
    const body = articleContentOf(page('<p>A body.</p><button><svg><path d="M0"/></svg>Copy</button>'), URL);
    expect(body).toBe("<p>A body.</p>");
  });

  test("removes scripts and style elements", () => {
    const body = articleContentOf(page("<style>p{color:red}</style><script>alert(1);</script><p>A body.</p>"), URL);
    expect(body).toBe("<p>A body.</p>");
  });

  test("removes heading links and the elements left empty by their removal", () => {
    const heading =
      '<h1 id="section">A Heading<span class="wrapper"><a data-heading-link href="#section"><span>#</span></a></span></h1>';
    expect(articleContentOf(page(heading), URL)).toBe('<h1 id="section">A Heading</h1>');
  });

  test("removes anything a component has marked as UI", () => {
    const body = articleContentOf(page("<p>A body.</p><div data-feed-omit><p>UI</p></div>"), URL);
    expect(body).toBe("<p>A body.</p>");
  });

  test("unwraps the spans left bare by sanitizing, keeping a code block's shape", () => {
    const code =
      '<pre><code><span class="line"><span style="color:red">token</span></span>\n<span class="line"></span>\ntoken</code></pre>';
    expect(articleContentOf(page(code), URL)).toBe("<pre><code>token\n\ntoken</code></pre>");
  });

  test("throws when the page does not hold exactly one article", () => {
    expect(() => articleContentOf("<html><body></body></html>", URL)).toThrow("found 0");
    expect(() => articleContentOf(page("<p>Paragraph 1.</p>") + page("<p>Paragraph 2.</p>"), URL)).toThrow("found 2");
  });
});
