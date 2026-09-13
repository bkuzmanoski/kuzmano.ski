import { expect, test, vi } from "vitest";

import { CONTACT_ROUTE } from "#/config/contact.ts";
import { collection, collectionEntries } from "#/test-utils/catalog.ts";

import { resolveContent } from "./resolve-content.ts";

vi.mock("./catalog.ts", async () => (await import("#/test-utils/catalog.ts")).siteCatalogMock());

const collectionEntry = collectionEntries[0]!;

test("a segment corresponding to a page resolves to that page, with its frontmatter", () => {
  expect(resolveContent("page")).toMatchObject({
    kind: "page",
    slug: "page",
    frontmatter: { title: "Page" },
  });
});

test("a slug belonging to a collection resolves to a collection entry, with its frontmatter", () => {
  expect(resolveContent("collection", collectionEntry.slug)).toMatchObject({
    kind: "collectionEntry",
    collection,
    slug: collectionEntry.slug,
    frontmatter: { title: collectionEntry.title },
  });
});

test("a page with an additional entry slug resolves to not found", () => {
  expect(resolveContent("page", "page")).toEqual({ kind: "notFound" });
});

test("a slug not present in a collection resolves to not found", () => {
  expect(resolveContent("collection", "does-not-exist")).toEqual({ kind: "notFound" });
});

test("a segment that is neither a collection nor a page resolves to not found", () => {
  expect(resolveContent("unknown-segment")).toEqual({ kind: "notFound" });
  expect(resolveContent("unknown-segment", "unknown-entry")).toEqual({ kind: "notFound" });
});

test("a segment corresponding to a collection resolves to that collection", () => {
  expect(resolveContent("collection")).toEqual({ kind: "collection", collection });
});

test("a segment corresponding to a feature resolves to its feature route", () => {
  expect(resolveContent(CONTACT_ROUTE.slice(1))).toEqual({ kind: "feature", route: CONTACT_ROUTE });
});

test("a feature segment with an additional slug resolves to not found", () => {
  expect(resolveContent(CONTACT_ROUTE.slice(1), "anything")).toEqual({ kind: "notFound" });
});
