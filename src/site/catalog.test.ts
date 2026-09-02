import { expect, test } from "vitest";

import type { TrackedPromise } from "#/lib/tracked-promise";
import { newestEntry, testCollection } from "#/test-utils/content";

import type { MDXModule } from "./catalog";

test("a loaded entry returns a fulfilled promise with its module", async () => {
  const { collection } = testCollection("blog");
  const { slug } = newestEntry("blog");

  await collection.load(slug);

  const reloaded = collection.load(slug) as TrackedPromise<MDXModule>;

  expect(reloaded.status).toBe("fulfilled");
  expect(reloaded.value).toHaveProperty("default");
});

test("loading an entry twice returns the same promise", () => {
  const { collection } = testCollection("blog");
  const { slug } = newestEntry("blog");

  expect(collection.load(slug)).toBe(collection.load(slug));
});

test("loading an entry that does not exist throws", () => {
  const { collection } = testCollection("blog");
  expect(() => collection.load("absent-entry")).toThrow(/Content not found/);
});
