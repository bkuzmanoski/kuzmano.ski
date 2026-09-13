import { expect, test } from "vitest";

import { SOCIAL_IMAGE } from "#/config/site.ts";
import { fakeCoverImage } from "#/test-utils/collection.ts";

import { canonicalUrl, documentHead } from "./metadata.ts";

import type { DocumentMetadata } from "./metadata.ts";

const DOCUMENT: DocumentMetadata = { title: "Title", description: "Description.", path: "/collection/entry" };

const robotsTagOf = (metadata: DocumentMetadata) =>
  documentHead(metadata).meta.find((tag) => "name" in tag && tag.name === "robots");
const propertyContentsOf = (metadata: DocumentMetadata, property: string) =>
  documentHead(metadata)
    .meta.filter((tag) => "property" in tag && tag.property === property)
    .map((tag) => ("content" in tag ? tag.content : undefined));

test("a document marked noindex emits a noindex robots tag", () => {
  expect(robotsTagOf({ ...DOCUMENT, noindex: true })).toEqual({ name: "robots", content: "noindex" });
});

test("a document the site publishes does not emit a robots tag", () => {
  expect(robotsTagOf(DOCUMENT)).toBeUndefined();
  expect(robotsTagOf({ ...DOCUMENT, noindex: false })).toBeUndefined();
});

test("a document marked noindex still emits its canonical URL", () => {
  const { links } = documentHead({ ...DOCUMENT, noindex: true });
  expect(links).toContainEqual({ rel: "canonical", href: canonicalUrl(DOCUMENT.path) });
});

test("a document with a cover image emits it as the Open Graph image, with its dimensions", () => {
  const coverImage = fakeCoverImage("entry");
  const document = { ...DOCUMENT, coverImage };

  expect(propertyContentsOf(document, "og:image")).toEqual([canonicalUrl(coverImage.social.src)]);
  expect(propertyContentsOf(document, "og:image:width")).toEqual(["512"]);
  expect(propertyContentsOf(document, "og:image:height")).toEqual(["512"]);
});

test("a document without a cover image emits the site image, without dimensions", () => {
  expect(propertyContentsOf(DOCUMENT, "og:image")).toEqual([canonicalUrl(SOCIAL_IMAGE)]);
  expect(propertyContentsOf(DOCUMENT, "og:image:width")).toEqual([]);
  expect(propertyContentsOf(DOCUMENT, "og:image:height")).toEqual([]);
});
