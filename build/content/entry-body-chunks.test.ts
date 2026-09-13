import { expect, test, vi } from "vitest";

import { CLIENT_ENVIRONMENT, SERVER_ENVIRONMENT } from "../environments.ts";
import { CONTENT_DIRECTORY_PATH, fromContent, fromRoot } from "../paths.ts";

import { entryBodyChunksPlugin, entryChunkDriftBetween, entryKeyOf, entryKeysIn } from "./entry-body-chunks.ts";

import type * as listing from "./listing.ts";
import type { ContentListing } from "./listing.ts";

vi.mock("./listing.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof listing>()),
  readContentListing: (): ContentListing => [
    { directoryName: "collection", fileNames: ["entry-1.mdx"], fileNamesBySubdirectoryName: {} },
  ],
}));

const VIRTUAL_MODULE_ID = "\0virtual:entry-body-chunks";
const CONTENT_LISTING: ContentListing = [
  {
    directoryName: "collection",
    fileNames: ["entry-1.mdx", "entry-1.cover.png", "entry-2.mdx"],
    fileNamesBySubdirectoryName: {},
  },
  { directoryName: "_pages", fileNames: ["page.mdx"], fileNamesBySubdirectoryName: {} },
];

type GenerateBundle = (this: unknown, options: unknown, bundle: Record<string, unknown>) => void;
type Load = (this: unknown, id: string) => string | null;

const loadIn = (load: Load, name: string, command: string, id = VIRTUAL_MODULE_ID) =>
  load.call({ environment: { name, config: { command } } }, id);

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
});

test("a missing module ID has no entry key", () => {
  expect(entryKeyOf(null)).toBeNull(); // Rollup reports a chunk without an entry module with a `null` module ID.
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
  expect(
    entryChunkDriftBetween(
      ["collection/entry-1", `/${CONTENT_DIRECTORY_PATH}/collection/entry-1.mdx`],
      ["collection/entry-1"],
    ),
  ).toEqual([`a chunk was produced for /${CONTENT_DIRECTORY_PATH}/collection/entry-1.mdx, which is not an entry`]);
});

test("the virtual module exports the body chunk URLs captured from the client build in the SSR build", () => {
  const [capture, provider] = entryBodyChunksPlugin();
  const throwError = (message: string) => {
    throw new Error(message);
  };

  (capture!.generateBundle as GenerateBundle).call(
    { environment: { config: { base: "/" } }, error: throwError },
    {},
    {
      "assets/entry-1.js": { type: "chunk", facadeModuleId: fromContent("collection/entry-1.mdx") },
      "assets/index.js": { type: "chunk", facadeModuleId: null },
    },
  );

  expect(loadIn(provider!.load as Load, SERVER_ENVIRONMENT, "build")).toBe(
    'export const ENTRY_BODY_CHUNKS = {"collection/entry-1":"/assets/entry-1.js"};',
  );
});

test("the virtual module exports an empty map outside the SSR build", () => {
  const [, provider] = entryBodyChunksPlugin();
  const load = provider!.load as Load;

  expect(loadIn(load, CLIENT_ENVIRONMENT, "build")).toContain("{}");
  expect(loadIn(load, SERVER_ENVIRONMENT, "serve")).toContain("{}");
});

test("the plugin returns `null` when loading a module other than its virtual module", () => {
  const [, provider] = entryBodyChunksPlugin();
  expect(loadIn(provider!.load as Load, SERVER_ENVIRONMENT, "build", "unrelated-module")).toBeNull();
});
