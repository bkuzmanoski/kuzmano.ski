import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { LoadingIndicator } from "#/components/loading-indicator.tsx";
import { documentTitle } from "#/site/metadata.ts";

import { verifyPrerenderedDocument } from "./verify.ts";

// The parts of a prerendered document that the verifier checks, with `body` as the window content.
const pageHtml = (body: string) => `<title>${documentTitle("Collection")}</title>
<nav aria-label="Main menu"></nav>
<section aria-label="Collection">
  <header><span>Collection</span></header>
  <div id="window-content">${body}</div>
</section>
`;

const verify =
  (html: string, path = "/collection") =>
  () =>
    verifyPrerenderedDocument({ page: { path }, html });

describe("verifyPrerenderedDocument", () => {
  test("throws when the menu bar is missing", () => {
    const html = pageHtml("<p>Menu Bar</p>").replace('aria-label="Main menu"', "");
    expect(verify(html)).toThrow(/menu bar is missing/);
  });

  test("accepts a document that rendered its content", () => {
    expect(verify(pageHtml("<p>Content</p>"))).not.toThrow();
  });

  test("throws when the window title does not match the document title", () => {
    const html = pageHtml("<p>Content</p>").replace('aria-label="Collection"', 'aria-label="Something else"');
    expect(verify(html)).toThrow(/there is no window titled/);
  });

  test("throws when the window has no `aria-label` attribute", () => {
    const html = pageHtml("<p>Content</p>").replace(' aria-label="Collection"', "");
    expect(verify(html)).toThrow(/there is no window titled/);
  });

  test("throws when the window body is empty", () => {
    expect(verify(pageHtml(""))).toThrow(/window body is empty/);
  });

  test("throws when a loading indicator remains in the window body", () => {
    const loadingIndicator = renderToStaticMarkup(createElement(LoadingIndicator, { layout: "fill" }));
    expect(verify(pageHtml(loadingIndicator))).toThrow(/window body contains a loading indicator/);
  });

  test("throws when a Suspense boundary rendered its fallback because a component threw", () => {
    const html = pageHtml("<!--$!--><template></template><p>Fallback</p><!--/$-->");
    expect(verify(html)).toThrow(/a component threw during the server render/);
  });

  test("throws when a Suspense boundary outside the window body rendered its fallback because a component threw", () => {
    const html = `<!--$!--><template></template><!--/$-->${pageHtml("<p>Content</p>")}`;
    expect(verify(html)).toThrow(/a component threw during the server render/);
  });

  test.each([
    ["its content", '<div hidden id="S:0"><p>Content</p></div><script>$RC("B:0","S:0")</script>'],
    ["its error", '<script>$RX("B:0","","Error")</script>'],
  ])(
    "throws when a Suspense boundary was still suspended when the shell was sent, and %s followed",
    (_, streamedMarkup) => {
      const html = `${pageHtml('<!--$?--><template id="B:0"></template><p>Fallback</p><!--/$-->')}${streamedMarkup}`;
      expect(verify(html)).toThrow(/a Suspense boundary was still suspended when the shell was sent/);
    },
  );

  test("accepts a Suspense boundary that rendered its content", () => {
    expect(verify(pageHtml("<!--$--><p>Content</p><!--/$-->"))).not.toThrow();
  });

  test("accepts a live region in the window body that is not a loading indicator", () => {
    expect(verify(pageHtml('<p>test@example.com</p><span role="status">Copied</span>'))).not.toThrow();
  });

  test("accepts document and window titles that encode the same characters with different escape sequences", () => {
    const html = `
      <title>${documentTitle("Q&amp;A&#x27;s")}</title>
      <nav aria-label="Main menu"></nav>
      <section aria-label="Q&#38;A's">
        <header><span>Q&#38;A's</span></header>
        <div id="window-content"><p>Content</p></div>
      </section>
    `;
    expect(verify(html, "/q-and-a")).not.toThrow();
  });

  test("accepts a document at the root path without open windows", () => {
    expect(verify('<nav aria-label="Main menu"></nav>', "/")).not.toThrow();
  });
});
