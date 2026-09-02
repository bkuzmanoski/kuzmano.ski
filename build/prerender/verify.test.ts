import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { Spinner } from "#/components/spinner.tsx";
import { documentTitle } from "#/metadata.ts";

import { verifyPrerenderedPage } from "./verify.ts";

// The parts of a prerendered page that the verifier checks, with `body` as the window content.
const pageHtml = (body: string) =>
  [
    `<title>${documentTitle("Collection")}</title>`,
    '<nav aria-label="Main menu"></nav>',
    `<section aria-labelledby="window-title"><header><span id="window-title">Collection</span></header><div id="window-content">${body}</div></section>`,
  ].join("");

const verify =
  (html: string, path = "/collection") =>
  () =>
    verifyPrerenderedPage({ page: { path }, html });

describe("verifyPrerenderedPage", () => {
  test("fails when the menu bar is missing", () => {
    const html = pageHtml("<p>Menu Bar</p>").replace('aria-label="Main menu"', "");
    expect(verify(html)).toThrow(/menu bar is missing/);
  });

  test("passes when a page rendered its content", () => {
    expect(verify(pageHtml("<p>Content</p>"))).not.toThrow();
  });

  test("fails when the window title does not match the page", () => {
    const html = pageHtml("<p>Content</p>").replace(">Collection<", ">Something else<");
    expect(verify(html)).toThrow(/there is no window titled/);
  });

  test("fails when the element labelling the window is missing", () => {
    const html = pageHtml("<p>Content</p>").replace('<header><span id="window-title">Collection</span></header>', "");
    expect(verify(html)).toThrow(/there is no window titled/);
  });

  test("fails when the window body is empty", () => {
    expect(verify(pageHtml(""))).toThrow(/window body is empty/);
  });

  test("the loading indicator has the prerender marker", () => {
    const loadingIndicator = renderToStaticMarkup(createElement(Spinner, { layout: "fill" }));
    expect(loadingIndicator).toContain("data-loading-indicator");
  });

  test("fails when a loading indicator remains in the window", () => {
    const loadingIndicator = renderToStaticMarkup(createElement(Spinner, { layout: "fill" }));
    expect(verify(pageHtml(loadingIndicator))).toThrow(/window body contains a loading indicator/);
  });

  test("passes when other live regions are present", () => {
    expect(verify(pageHtml('<p>test@example.com</p><span role="status">Copied</span>'))).not.toThrow();
  });

  test("passes when the page has no open windows", () => {
    expect(verify('<nav aria-label="Main menu"></nav>', "/")).not.toThrow();
  });
});
