import { describe, expect, test } from "vitest";

import { SITE_URL } from "#/config/site.ts";

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

    expect(body).toContain(`href="${SITE_URL}/collection"`);
    expect(body).toContain(`src="${SITE_URL}/image.png"`);
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

  test("removes the `id` attribute of an element that is not a heading when a link in the article does not name it", () => {
    const body = articleContentOf(
      articleDocument('<aside aria-labelledby="_R_1_"><p id="_R_1_">A label.</p><p>A note.</p></aside>'),
      ENTRY_URL,
    );
    expect(body).toBe("<p>A label.</p><p>A note.</p>");
  });

  test("preserves the `id` attribute of an element that a link in the article names", () => {
    const body = articleContentOf(articleDocument('<a href="#note">A link.</a><p id="note">A note.</p>'), ENTRY_URL);
    expect(body).toContain('<p id="note">A note.</p>');
  });

  test("preserves the `id` attribute of each `<th>` that the `headers` attribute of a cell names", () => {
    const body = articleContentOf(
      articleDocument(
        '<table><tr><th id="column">Column</th><th id="row">Row</th><td headers="column row">A value.</td></tr></table>',
      ),
      ENTRY_URL,
    );
    expect(body).toContain('<th id="column">Column</th><th id="row">Row</th>');
  });

  test("removes an element that has a `data-feed-omit` attribute", () => {
    const body = articleContentOf(articleDocument("<p>A body.</p><div data-feed-omit><p>UI</p></div>"), ENTRY_URL);
    expect(body).toBe("<p>A body.</p>");
  });

  test("removes an `<aside>` left with only its label once its elements with a `data-feed-omit` attribute are removed", () => {
    const body = articleContentOf(
      articleDocument(`<p>A body.</p><aside aria-labelledby="label">
  <p id="label">Label</p>
  <button data-feed-omit>Print</button>
</aside>`),
      ENTRY_URL,
    );
    expect(body).toBe("<p>A body.</p>");
  });

  test("removes an unlabeled `<aside>` left empty once its elements with a `data-feed-omit` attribute are removed", () => {
    const body = articleContentOf(
      articleDocument("<p>A body.</p><aside><button data-feed-omit>Print</button></aside>"),
      ENTRY_URL,
    );
    expect(body).toBe("<p>A body.</p>");
  });

  test("preserves the contents of an `<aside>` left with more than its label once its elements with a `data-feed-omit` attribute are removed", () => {
    const body = articleContentOf(
      articleDocument(
        '<aside aria-labelledby="label"><p id="label">Label</p><p>A note.</p><button data-feed-omit>Print</button></aside>',
      ),
      ENTRY_URL,
    );
    expect(body).toBe("<p>Label</p><p>A note.</p>");
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

  test("moves each footnote into an `<li>` with its ID, in an `<ol>` after an `<hr>` at the end of the article, without its rail label", () => {
    const body = articleContentOf(
      articleDocument(`<p>A sentence.<sup><a href="#fn-1" id="fnref-1" aria-label="Footnote 1">1</a></sup></p>
<div data-rail-asides style="--content-body-rail-subject:--content-body-rail-subject-1"><aside id="fn-1" role="doc-footnote" tabindex="-1" aria-label="Footnote 1" data-footnote><p aria-hidden="true" data-feed-omit>1</p><p>A note. <a href="#fnref-1" aria-label="Back to reference 1">↩︎</a></p></aside></div>
<p>A second paragraph.</p>`),
      ENTRY_URL,
    );

    expect(body)
      .toBe(`<p>A sentence.<sup><a href="${ENTRY_URL}#fn-1" id="fnref-1" aria-label="Footnote 1">1</a></sup></p>

<p>A second paragraph.</p><hr><ol><li id="fn-1"><p>A note. <a href="${ENTRY_URL}#fnref-1" aria-label="Back to reference 1">↩︎</a></p></li></ol>`);
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

    expect(body).toContain(`srcset="${SITE_URL}/image-1.avif 1x, ${SITE_URL}/image-2.avif 2x"`);
    expect(body).toContain(`src="${SITE_URL}/image-1.png"`);
  });

  test("preserves a `<video>`, resolving its `src` and `poster` attributes", () => {
    const body = articleContentOf(
      articleDocument('<video src="/video.mp4" poster="/video-poster.png" controls></video>'),
      ENTRY_URL,
    );

    expect(body).toContain(`src="${SITE_URL}/video.mp4"`);
    expect(body).toContain(`poster="${SITE_URL}/video-poster.png"`);
  });

  test("adds the `controls` attribute to a `<video>` or an `<audio>` that do not have it", () => {
    const body = articleContentOf(
      articleDocument('<video src="/video.mp4" muted loop></video><audio src="/audio.mp3"></audio>'),
      ENTRY_URL,
    );

    expect(body).toMatch(/<video [^>]*controls/);
    expect(body).toMatch(/<audio [^>]*controls/);
  });

  test("adds a link to the file of a `<video>` or an `<audio>` as their fallback content", () => {
    const body = articleContentOf(
      articleDocument('<video src="/video.mp4"></video><audio><source src="/audio.mp3" type="audio/mpeg"></audio>'),
      ENTRY_URL,
    );

    expect(body).toContain(`<a href="${SITE_URL}/video.mp4">Watch the video</a></video>`);
    expect(body).toContain(`<a href="${SITE_URL}/audio.mp3">Listen to the audio</a></audio>`);
  });

  test("uses the `aria-label` attribute of a `<video>` as the text of its fallback link", () => {
    const body = articleContentOf(
      articleDocument('<video src="/video.mp4" aria-label="A video description"></video>'),
      ENTRY_URL,
    );
    expect(body).toContain(`<a href="${SITE_URL}/video.mp4">A video description</a></video>`);
  });

  test("resolves the `cite` attribute of a `<blockquote>` against the entry's URL", () => {
    const body = articleContentOf(
      articleDocument('<blockquote cite="/source"><p>A quotation.</p></blockquote>'),
      ENTRY_URL,
    );
    expect(body).toContain(`cite="${SITE_URL}/source"`);
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
