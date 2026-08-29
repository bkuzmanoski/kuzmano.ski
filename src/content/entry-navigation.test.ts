import { expect, test } from "vitest";

import { testCollection } from "#/test-utils/content";

import { entrySiblings } from "./entry-navigation";

const { collection, entries, routeOf } = testCollection("blog", 3);
const lastEntryIndex = entries.length - 1;

test("the newest entry does not have a previous entry", () => {
  expect(entrySiblings(collection, entries[0]!.slug)).toEqual({ previous: null, next: routeOf(1) });
});

test("the oldest entry does not have a next entry", () => {
  expect(entrySiblings(collection, entries[lastEntryIndex]!.slug)).toEqual({
    previous: routeOf(lastEntryIndex - 1),
    next: null,
  });
});

test("an entry in the middle steps to the entries either side of it in the listing", () => {
  expect(entrySiblings(collection, entries[1]!.slug)).toEqual({ previous: routeOf(0), next: routeOf(2) });
});

test("an entry the listing does not hold has no siblings", () => {
  expect(entrySiblings(collection, "not-in-the-listing")).toEqual({ previous: null, next: null });
});

test("a collection of one entry has no siblings to step to", () => {
  const single = { ...collection, list: () => [entries[0]!] };
  expect(entrySiblings(single, entries[0]!.slug)).toEqual({ previous: null, next: null });
});
