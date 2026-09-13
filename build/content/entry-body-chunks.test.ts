import { expect, test } from "vitest";

import { CLIENT_ENVIRONMENT, SERVER_ENVIRONMENT } from "../environments.ts";
import { CONTENT_DIRECTORY_PATH, fromContent, fromRoot } from "../paths.ts";

import { entryBodyChunksPlugin, entryChunkDriftBetween, entryKeyOf, entryKeysIn } from "./entry-body-chunks.ts";

import type { ContentListing } from "./listing.ts";

const CONTENT_LISTING: ContentListing = [
  {
    directoryName: "collection",
    fileNames: ["entry-1.mdx", "entry-1.cover.png", "entry-2.mdx"],
    fileNamesBySubdirectoryName: {},
  },
  { directoryName: "_pages", fileNames: ["page.mdx"], fileNamesBySubdirectoryName: {} },
];

test("an entry's module ID becomes the key composed from its directory and slug", () => {
  expect(entryKeyOf(fromContent("collection/entry.mdx"))).toBe("collection/entry");
  expect(entryKeyOf(fromContent("_pages/page.mdx"))).toBe("_pages/page");
});

test("a module ID that is not an `.mdx` file exactly two levels below the content root has no entry key", () => {
  expect(entryKeyOf(fromContent("index.ts"))).toBeNull();
  expect(entryKeyOf(fromContent("loose.mdx"))).toBeNull();
  expect(entryKeyOf(fromContent("collection/entry/nested.mdx"))).toBeNull();
  expect(entryKeyOf(fromRoot("README.md"))).toBeNull();
  expect(entryKeyOf(fromRoot("docs/notes.mdx"))).toBeNull();
  expect(entryKeyOf(null)).toBeNull();
});

test("the entry keys of a listing are the keys of its `.mdx` files, in listing order", () => {
  expect(entryKeysIn(CONTENT_LISTING)).toEqual(["collection/entry-1", "collection/entry-2", "_pages/page"]);
});

test("chunks matching the entries on disk are accepted", () => {
  expect(entryChunkDriftBetween(entryKeysIn(CONTENT_LISTING), entryKeysIn(CONTENT_LISTING))).toEqual([]);
});

test("an entry the build did not produce a chunk for is reported, by key", () => {
  expect(entryChunkDriftBetween(["collection/entry-1"], ["collection/entry-1", "_pages/page"])).toEqual([
    "no chunk was produced for _pages/page",
  ]);
});

test("a chunk keyed by something that is not an entry is reported, by key", () => {
  expect(entryChunkDriftBetween([`/${CONTENT_DIRECTORY_PATH}/collection/entry-1.mdx`], ["collection/entry-1"])).toEqual(
    [
      "no chunk was produced for collection/entry-1",
      `a chunk was produced for /${CONTENT_DIRECTORY_PATH}/collection/entry-1.mdx, which is not an entry`,
    ],
  );
});

test("the entry body chunks plugin exports an empty map outside the SSR build, and loads only its virtual module", () => {
  const [, provider] = entryBodyChunksPlugin();

  const load = provider!.load as (this: unknown, id: string) => string | null;
  const loadIn = (name: string, command: string) =>
    load.call({ environment: { name, config: { command } } }, "\0virtual:entry-body-chunks");

  expect(loadIn(CLIENT_ENVIRONMENT, "build")).toContain("{}");
  expect(loadIn(SERVER_ENVIRONMENT, "serve")).toContain("{}");
  expect(
    load.call({ environment: { name: SERVER_ENVIRONMENT, config: { command: "build" } } }, "unrelated-module"),
  ).toBeNull();
});
