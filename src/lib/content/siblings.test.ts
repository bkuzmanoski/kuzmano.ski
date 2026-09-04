import { expect, test } from "vitest";

import { fakeCollection, fakeCollectionEntries } from "#/test-utils/collection.ts";

import { entrySiblings } from "./siblings.ts";

const collectionEntries = fakeCollectionEntries("newest", "middle", "oldest");
const collection = fakeCollection(collectionEntries);
const routeOf = (slug: string) => collection.routeOf(slug);

test("the newest entry does not have a previous entry", () => {
  expect(entrySiblings(collection, "newest")).toEqual({ previous: null, next: routeOf("middle") });
});

test("the oldest entry does not have a next entry", () => {
  expect(entrySiblings(collection, "oldest")).toEqual({ previous: routeOf("middle"), next: null });
});

test("an entry in the middle has the entries either side of it in the listing", () => {
  expect(entrySiblings(collection, "middle")).toEqual({ previous: routeOf("newest"), next: routeOf("oldest") });
});

test("an entry the listing does not hold has no siblings", () => {
  expect(entrySiblings(collection, "not-in-the-listing")).toEqual({ previous: null, next: null });
});

test("a collection of one entry has no siblings", () => {
  const single = fakeCollection([collectionEntries[0]!]);
  expect(entrySiblings(single, "newest")).toEqual({ previous: null, next: null });
});
