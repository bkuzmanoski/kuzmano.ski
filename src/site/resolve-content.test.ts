import { expect, test, vi } from "vitest";

import { CONTACT_ROUTE } from "#/config/contact.ts";
import { collection, collectionEntries } from "#/test-utils/catalog.ts";

import { resolveContent } from "./resolve-content.ts";

vi.mock("./catalog.ts", async () => (await import("#/test-utils/catalog.ts")).siteCatalogMock());

const collectionEntry = collectionEntries[0]!;

test("a segment holding a page resolves to that page, with its frontmatter", () => {
  expect(resolveContent("page")).toMatchObject({
    kind: "page",
    slug: "page",
    frontmatter: { title: "Page" },
  });
});

test("a slug in a collection resolves to a collection entry, with its frontmatter", () => {
  expect(resolveContent("collection", collectionEntry.slug)).toMatchObject({
    kind: "collectionEntry",
    collection,
    slug: collectionEntry.slug,
    frontmatter: { title: collectionEntry.title },
  });
});

test("a segment holding a collection resolves to that collection", () => {
  expect(resolveContent("collection")).toEqual({ kind: "collection", collection });
});

test("a reserved segment resolves to the route it reserves rather than to content", () => {
  expect(resolveContent(CONTACT_ROUTE.slice(1))).toEqual({ kind: "reserved", route: CONTACT_ROUTE });
});

// A window serves a reserved route, so there are no entries beneath it.
test("a slug under a reserved segment resolves to not found", () => {
  expect(resolveContent(CONTACT_ROUTE.slice(1), "anything")).toEqual({ kind: "notFound" });
});

test("a slug the collection does not hold resolves to not found", () => {
  expect(resolveContent("collection", "does-not-exist")).toEqual({ kind: "notFound" });
});

test("a segment that is neither a collection nor a page resolves to not found", () => {
  expect(resolveContent("unknown-segment")).toEqual({ kind: "notFound" });
  expect(resolveContent("unknown-segment", "unknown-entry")).toEqual({ kind: "notFound" });
});

test("a page addressed as a collection entry resolves to not found", () => {
  expect(resolveContent("page", "page")).toEqual({ kind: "notFound" });
});
