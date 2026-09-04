import { expect, test } from "vitest";

import { canonicalUrl, documentHead } from "./metadata.ts";

import type { DocumentMetadata } from "./metadata.ts";

const DOCUMENT: DocumentMetadata = { title: "Title", description: "Description.", path: "/collection/entry" };

const robotsOf = (metadata: DocumentMetadata) =>
  documentHead(metadata).meta.find((tag) => "name" in tag && tag.name === "robots");

test("a document marked noindex emits a noindex robots tag", () => {
  expect(robotsOf({ ...DOCUMENT, noindex: true })).toEqual({ name: "robots", content: "noindex" });
});

test("a document the site publishes does not emit a robots tag", () => {
  expect(robotsOf(DOCUMENT)).toBeUndefined();
  expect(robotsOf({ ...DOCUMENT, noindex: false })).toBeUndefined();
});

test("a document marked noindex keeps its canonical URL", () => {
  const { links } = documentHead({ ...DOCUMENT, noindex: true });
  expect(links).toContainEqual({ rel: "canonical", href: canonicalUrl(DOCUMENT.path) });
});
