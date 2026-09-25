import { describe, expect, test } from "vitest";

import { readStylesheetProblems, unresolvedUrlsIn, urlsIn } from "./css-assets.ts";

const cssRule = (reference: string) => `.a { background-image: url("${reference}"); }`;
const noFile = () => false;

test("every relative `url()` in the stylesheets under `/src` resolves to a file", async () => {
  expect(await readStylesheetProblems()).toEqual([]);
});

describe("unresolvedUrlsIn", () => {
  test("omits a relative `url()` that resolves to a file", () => {
    expect(unresolvedUrlsIn(cssRule("../assets/images/image.svg"), () => true)).toEqual([]);
  });

  test("returns a relative `url()` without a file at its path, as written", () => {
    expect(unresolvedUrlsIn(cssRule("../assets/images/image.svg"), noFile)).toEqual(["../assets/images/image.svg"]);
  });

  test("ignores a data URI", () => {
    const css = cssRule("data:image/svg+xml,%3Csvg%3E%3Crect filter='url(%23n)'/%3E%3C/svg%3E");
    expect(unresolvedUrlsIn(css, noFile)).toEqual([]);
  });

  test("ignores an absolute URL", () => {
    expect(unresolvedUrlsIn(cssRule("https://example.com/image.svg"), noFile)).toEqual([]);
  });

  test("ignores a root-relative `url()`", () => {
    expect(unresolvedUrlsIn(cssRule("/image.svg"), noFile)).toEqual([]);
  });

  test("returns a quoted `url()` whose path contains a bracket, as written", () => {
    expect(unresolvedUrlsIn(cssRule("../assets/images/image (1).svg"), noFile)).toEqual([
      "../assets/images/image (1).svg",
    ]);
  });

  test("returns a `url()` without a file at its path that follows a data URI containing a bracket", () => {
    const dataUri = "data:image/svg+xml,%3Csvg%3E%3Crect filter='url(%23n)'/%3E%3C/svg%3E";
    const css = `.a { background-image: url("${dataUri}"), url("./missing.svg"); }`;

    expect(unresolvedUrlsIn(css, noFile)).toEqual(["./missing.svg"]);
  });

  test("returns every `url()` in a multi-value shorthand in source order", () => {
    const css = ".a { background: url(image1.svg) no-repeat, url(image2.svg); }";
    expect(unresolvedUrlsIn(css, noFile)).toEqual(["image1.svg", "image2.svg"]);
  });

  test("returns a `url()` without a file at its path in an at-rule prelude", () => {
    expect(unresolvedUrlsIn('@import url("./stylesheet.css");', noFile)).toEqual(["./stylesheet.css"]);
  });

  test("returns a `url()` without a file at its path in a declaration inside an at-rule", () => {
    const css = '@font-face { font-family: Font; src: url("../assets/fonts/font.woff2"); }';
    expect(unresolvedUrlsIn(css, noFile)).toEqual(["../assets/fonts/font.woff2"]);
  });

  test("checks the decoded path of an unquoted `url()` with an escaped space", () => {
    const css = String.raw`.a { background-image: url(./image\ 1.svg); }`;
    expect(unresolvedUrlsIn(css, (filePath) => filePath === "./image 1.svg")).toEqual([]);
  });

  test("checks the decoded path of a `url()` with a hex escape", () => {
    const css = String.raw`.a { background-image: url("./image\31 .svg"); }`;
    expect(unresolvedUrlsIn(css, (filePath) => filePath === "./image1.svg")).toEqual([]);
  });

  test("returns an escaped `url()` without a file at its path, as written", () => {
    const css = String.raw`.a { background-image: url(./image\ 1.svg); }`;
    expect(unresolvedUrlsIn(css, noFile)).toEqual([String.raw`./image\ 1.svg`]);
  });

  test("checks the path of a `url()` without its query string", () => {
    expect(unresolvedUrlsIn(cssRule("./image.svg?query=value"), (filePath) => filePath === "./image.svg")).toEqual([]);
  });

  test("treats an escaped question mark in a `url()` as part of the path", () => {
    const css = String.raw`.a { background-image: url(./image\?.svg); }`;
    expect(unresolvedUrlsIn(css, (filePath) => filePath === "./image?.svg")).toEqual([]);
  });
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

  test("returns an empty array for a `url()` without a reference", () => {
    expect(urlsIn("url()")).toEqual([]);
  });

  test("returns an empty array for a value without a `url()`", () => {
    expect(urlsIn("16px solid var(--color-border)")).toEqual([]);
  });
});
