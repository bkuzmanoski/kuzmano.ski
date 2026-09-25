import { expect, test, vi } from "vitest";

import { CLIENT_ENVIRONMENT, SERVER_ENVIRONMENT } from "../environments.ts";
import { CONTENT_DIRECTORY_PATH, fromContent, fromRoot } from "../paths.ts";

import {
  entryBodyChunksIn,
  entryBodyChunksPlugin,
  entryChunkDriftBetween,
  entryKeyOf,
  entryKeysIn,
} from "./entry-body-chunks.ts";

import type { BundledChunk } from "./entry-body-chunks.ts";
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
type Load = (this: unknown, id: string) => Promise<string | null>;

const chunkOf = (fileName: string, chunk: Partial<BundledChunk> = {}): BundledChunk => ({
  fileName,
  facadeModuleId: null,
  isEntry: false,
  imports: [],
  ...chunk,
});
const stylesheetsOf = (...fileNames: Array<string>) => ({ viteMetadata: { importedCss: new Set(fileNames) } });
const loadedModuleFor = (load: Load, name: string, command: string) =>
  load.call({ environment: { name, config: { command } } }, VIRTUAL_MODULE_ID);

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

test("an entry loads its body chunk and the chunk of the stylesheet beside it, with the stylesheet of each", () => {
  const chunks = [
    chunkOf("assets/entry.js", {
      facadeModuleId: fromContent("collection/entry.mdx"),
      ...stylesheetsOf("assets/entry.css"),
    }),
    chunkOf("assets/entry.module.js", {
      facadeModuleId: fromContent("collection/entry.module.css"),
      ...stylesheetsOf("assets/entry.module.css"),
    }),
  ];
  expect(entryBodyChunksIn(chunks, "/")).toEqual({
    "collection/entry": {
      moduleUrls: ["/assets/entry.js", "/assets/entry.module.js"],
      stylesheetUrls: ["/assets/entry.css", "/assets/entry.module.css"],
    },
  });
});

test("an entry loads each chunk its body chunk imports statically, directly or through another chunk, with its stylesheet", () => {
  const chunks = [
    chunkOf("assets/entry.js", { facadeModuleId: fromContent("collection/entry.mdx"), imports: ["assets/shared.js"] }),
    chunkOf("assets/shared.js", { imports: ["assets/nested.js"], ...stylesheetsOf("assets/shared.css") }),
    chunkOf("assets/nested.js", { imports: ["assets/shared.js"], ...stylesheetsOf("assets/nested.css") }),
  ];
  expect(entryBodyChunksIn(chunks, "/")).toEqual({
    "collection/entry": {
      moduleUrls: ["/assets/entry.js", "/assets/shared.js", "/assets/nested.js"],
      stylesheetUrls: ["/assets/shared.css", "/assets/nested.css"],
    },
  });
});

test("an entry does not load the chunk of the hydration entry or a chunk it imports statically", () => {
  const chunks = [
    chunkOf("assets/index.js", { isEntry: true, imports: ["assets/vendor.js"], ...stylesheetsOf("assets/index.css") }),
    chunkOf("assets/vendor.js", stylesheetsOf("assets/vendor.css")),
    chunkOf("assets/entry.js", {
      facadeModuleId: fromContent("collection/entry.mdx"),
      imports: ["assets/index.js", "assets/vendor.js"],
    }),
  ];
  expect(entryBodyChunksIn(chunks, "/")).toEqual({
    "collection/entry": { moduleUrls: ["/assets/entry.js"], stylesheetUrls: [] },
  });
});

test("the URLs of an entry's chunks and stylesheets begin with the base", () => {
  const chunks = [
    chunkOf("assets/entry.js", {
      facadeModuleId: fromContent("collection/entry.mdx"),
      ...stylesheetsOf("assets/entry.css"),
    }),
  ];
  expect(entryBodyChunksIn(chunks, "/base/")).toEqual({
    "collection/entry": { moduleUrls: ["/base/assets/entry.js"], stylesheetUrls: ["/base/assets/entry.css"] },
  });
});

test("the virtual module exports the body chunks captured from the client build in the SSR build", async () => {
  const [capture, provider] = entryBodyChunksPlugin();
  const throwError = (message: string) => {
    throw new Error(message);
  };

  (capture!.generateBundle as GenerateBundle).call(
    { environment: { config: { base: "/" } }, error: throwError },
    {},
    {
      "assets/entry-1.js": {
        type: "chunk",
        ...chunkOf("assets/entry-1.js", { facadeModuleId: fromContent("collection/entry-1.mdx") }),
      },
      "assets/index.js": { type: "chunk", ...chunkOf("assets/index.js", { isEntry: true }) },
      "assets/index.css": { type: "asset", fileName: "assets/index.css" },
    },
  );

  await expect(loadedModuleFor(provider!.load as Load, SERVER_ENVIRONMENT, "build")).resolves.toBe(
    'export const ENTRY_BODY_CHUNKS = {"collection/entry-1":{"moduleUrls":["/assets/entry-1.js"],"stylesheetUrls":[]}};',
  );
});

test("the virtual module exports an empty map outside the SSR build", async () => {
  const [, provider] = entryBodyChunksPlugin();
  const load = provider!.load as Load;

  await expect(loadedModuleFor(load, CLIENT_ENVIRONMENT, "build")).resolves.toBe(
    "export const ENTRY_BODY_CHUNKS = {};",
  );
  await expect(loadedModuleFor(load, SERVER_ENVIRONMENT, "serve")).resolves.toBe(
    "export const ENTRY_BODY_CHUNKS = {};",
  );
});
