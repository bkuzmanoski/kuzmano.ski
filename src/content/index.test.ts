import { expect, test } from "vitest";

import type { MDXModule } from "#/content";
import type { TrackedPromise } from "#/lib/tracked-promise";
import { newestEntry, testCollection } from "#/test-utils/content";

test("a loaded entry returns a fulfilled promise with its module", async () => {
  const { collection } = testCollection("tech-notes");
  const { slug } = newestEntry("tech-notes");

  await collection.load(slug);

  const reloaded = collection.load(slug) as TrackedPromise<MDXModule>;

  expect(reloaded.status).toBe("fulfilled");
  expect(reloaded.value).toHaveProperty("default");
});

test("loading an entry twice returns the same promise", () => {
  const { collection } = testCollection("tech-notes");
  const { slug } = newestEntry("tech-notes");

  expect(collection.load(slug)).toBe(collection.load(slug));
});

test("loading an entry that does not exist throws", () => {
  const { collection } = testCollection("tech-notes");
  expect(() => collection.load("absent-entry")).toThrow(/Content not found/);
});
