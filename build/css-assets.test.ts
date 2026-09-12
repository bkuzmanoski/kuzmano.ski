import { describe, expect, test } from "vitest";

import { readStylesheets, unresolvedUrlsIn, urlsIn } from "./css-assets.ts";

const cssRule = (reference: string) => `.a { background-image: url("${reference}"); }`;
const noFile = () => false;

test("every relative `url()` in the stylesheets under `/src` resolves to a file", async () => {
  expect((await readStylesheets()).problems).toEqual([]);
});

test("a relative `url()` that resolves to a file is not resolved", () => {
  expect(unresolvedUrlsIn(cssRule("../assets/images/image.svg"), () => true)).toEqual([]);
});

test("a relative `url()` with no file at its path is resolved as written", () => {
  expect(unresolvedUrlsIn(cssRule("../assets/images/image.svg"), noFile)).toEqual(["../assets/images/image.svg"]);
});

test("a data URI is not resolved", () => {
  const css = cssRule("data:image/svg+xml,%3Csvg%3E%3Crect filter='url(%23n)'/%3E%3C/svg%3E");
  expect(unresolvedUrlsIn(css, noFile)).toEqual([]);
});

test("an absolute URL is not resolved", () => {
  expect(unresolvedUrlsIn(cssRule("https://example.com/image.svg"), noFile)).toEqual([]);
});

test("a root-relative `url()` is not resolved", () => {
  expect(unresolvedUrlsIn(cssRule("/image.svg"), noFile)).toEqual([]);
});

test("a quoted `url()` whose path contains a bracket is resolved as written", () => {
  expect(unresolvedUrlsIn(cssRule("../assets/images/image (1).svg"), noFile)).toEqual([
    "../assets/images/image (1).svg",
  ]);
});

test("a `url()` following a data URI containing a bracket is resolved", () => {
  const dataUri = "data:image/svg+xml,%3Csvg%3E%3Crect filter='url(%23n)'/%3E%3C/svg%3E";
  const css = `.a { background-image: url("${dataUri}"), url("./missing.svg"); }`;

  expect(unresolvedUrlsIn(css, noFile)).toEqual(["./missing.svg"]);
});

test("every `url()` in a multi-value shorthand is resolved in source order", () => {
  const css = ".a { background: url(image1.svg) no-repeat, url(image2.svg); }";
  expect(unresolvedUrlsIn(css, noFile)).toEqual(["image1.svg", "image2.svg"]);
});

test("a `url()` in an at-rule prelude with no file at its path is resolved", () => {
  expect(unresolvedUrlsIn('@import url("./stylesheet.css");', noFile)).toEqual(["./stylesheet.css"]);
});

test("a `url()` in a declaration inside an at-rule with no file at its path is resolved", () => {
  const css = '@font-face { font-family: Font; src: url("../assets/fonts/font.woff2"); }';
  expect(unresolvedUrlsIn(css, noFile)).toEqual(["../assets/fonts/font.woff2"]);
});

test("an unquoted `url()` with an escaped space is not unresolved when its decoded path exists", () => {
  const css = String.raw`.a { background-image: url(./image\ 1.svg); }`;
  expect(unresolvedUrlsIn(css, (filePath) => filePath === "./image 1.svg")).toEqual([]);
});

test("a `url()` with a hex-escaped path checks the decoded character", () => {
  const css = String.raw`.a { background-image: url("./image\31 .svg"); }`;
  expect(unresolvedUrlsIn(css, (filePath) => filePath === "./image1.svg")).toEqual([]);
});

test("an escaped `url()` with no file at its path is resolved as written", () => {
  const css = String.raw`.a { background-image: url(./image\ 1.svg); }`;
  expect(unresolvedUrlsIn(css, noFile)).toEqual([String.raw`./image\ 1.svg`]);
});

test("a `url()` with a query checks the path without the query string", () => {
  expect(unresolvedUrlsIn(cssRule("./image.svg?query=value"), (filePath) => filePath === "./image.svg")).toEqual([]);
});

test("an escaped question mark in a `url()` is treated as part of the path", () => {
  const css = String.raw`.a { background-image: url(./image\?.svg); }`;
  expect(unresolvedUrlsIn(css, (filePath) => filePath === "./image?.svg")).toEqual([]);
});

describe("urlsIn", () => {
  test("returns every `url()` reference in a value, as written and in source order", () => {
    expect(urlsIn('url("./a.svg") no-repeat, url(./b.svg)')).toEqual(["./a.svg", "./b.svg"]);
  });

  test("returns data URI and root-relative references", () => {
    expect(urlsIn('url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E"), url(/image.svg)')).toEqual([
      "data:image/svg+xml,%3Csvg%3E%3C/svg%3E",
      "/image.svg",
    ]);
  });

  test("returns an empty array for a `url()` with no reference in it", () => {
    expect(urlsIn("url()")).toEqual([]);
  });

  test("returns an empty array for a value with no `url()` in it", () => {
    expect(urlsIn("16px solid var(--color-border)")).toEqual([]);
  });
});
