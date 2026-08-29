import { expect, test } from "vitest";

import { contentAssetsPlugin, contentKeyOf } from "./content-assets.ts";
import { CONTENT_DIRECTORY, fromRoot } from "./paths.ts";

const contentPath = (path: string) => fromRoot(`${CONTENT_DIRECTORY}/${path}`);

test("a content file gets the same key `import.meta.glob` uses for it", () => {
  expect(contentKeyOf(contentPath("collection/entry.mdx"))).toBe("./collection/entry.mdx");
  expect(contentKeyOf(contentPath("_pages/about.mdx"))).toBe("./_pages/about.mdx");
});

test("a non-content module has no content key", () => {
  expect(contentKeyOf(contentPath("index.ts"))).toBeNull();
  expect(contentKeyOf(fromRoot("README.md"))).toBeNull();
  expect(contentKeyOf(fromRoot("docs/notes.mdx"))).toBeNull();
  expect(contentKeyOf(null)).toBeNull();
});

test("the content asset map is populated only by the server build", () => {
  const [, provider] = contentAssetsPlugin();

  const load = provider!.load as (this: unknown, id: string) => string | null;
  const loadIn = (name: string, command: string) =>
    load.call({ environment: { name, config: { command } } }, "\0virtual:content-assets");

  expect(loadIn("client", "build")).toContain("{}");
  expect(loadIn("ssr", "serve")).toContain("{}");
  expect(load.call({ environment: { name: "ssr", config: { command: "build" } } }, "unrelated-module")).toBeNull();
});
