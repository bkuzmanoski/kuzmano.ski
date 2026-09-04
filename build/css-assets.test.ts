import { expect, test } from "vitest";

import { findUnresolvedUrls, readUnresolvedUrls } from "./css-assets.ts";

const rule = (reference: string) => `.a { background-image: url("${reference}"); }`;
const noFile = () => false;

test("every relative `url()` in the stylesheets under `/src` resolves to a file", async () => {
  expect((await readUnresolvedUrls()).unresolved).toEqual([]);
});

test("a relative `url()` that resolves to a file is not reported", () => {
  expect(findUnresolvedUrls(rule("../assets/images/logo.svg"), () => true)).toEqual([]);
});

test("a relative `url()` with no file at its path is reported as written", () => {
  expect(findUnresolvedUrls(rule("../assets/images/logo.svg"), noFile)).toEqual(["../assets/images/logo.svg"]);
});

test("a data URI is not reported", () => {
  const css = rule("data:image/svg+xml,%3Csvg%3E%3Crect filter='url(%23n)'/%3E%3C/svg%3E");
  expect(findUnresolvedUrls(css, noFile)).toEqual([]);
});

test("an absolute URL is not reported", () => {
  expect(findUnresolvedUrls(rule("https://example.com/logo.svg"), noFile)).toEqual([]);
});

test("a root-relative `url()` is not reported", () => {
  expect(findUnresolvedUrls(rule("/logo.svg"), noFile)).toEqual([]);
});
