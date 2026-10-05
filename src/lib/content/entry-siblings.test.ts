import { expect, test } from "vitest";

import { fakeCollection, fakeCollectionEntries } from "#/test-utils/collection.ts";

import { entrySiblings } from "./entry-siblings.ts";

const COLLECTION_ENTRIES = fakeCollectionEntries("newest", "middle", "oldest");
const COLLECTION = fakeCollection(COLLECTION_ENTRIES);
const [NEWEST_ENTRY, MIDDLE_ENTRY, OLDEST_ENTRY] = COLLECTION_ENTRIES;

test("the newest entry has only an older entry", () => {
  expect(entrySiblings(COLLECTION, "newest")).toEqual({ newer: null, older: MIDDLE_ENTRY });
});

test("the oldest entry has only a newer entry", () => {
  expect(entrySiblings(COLLECTION, "oldest")).toEqual({ newer: MIDDLE_ENTRY, older: null });
});

test("an entry in the middle has the entries either side of it in the collection", () => {
  expect(entrySiblings(COLLECTION, "middle")).toEqual({ newer: NEWEST_ENTRY, older: OLDEST_ENTRY });
});

test("an entry outside the collection has no siblings", () => {
  expect(entrySiblings(COLLECTION, "outside-the-collection")).toEqual({ newer: null, older: null });
});

test("the only entry in a collection has no siblings", () => {
  const single = fakeCollection([COLLECTION_ENTRIES[0]!]);
  expect(entrySiblings(single, "newest")).toEqual({ newer: null, older: null });
});
