import { describe, expect, test } from "vitest";

import { RESOLVED_MARKDOWN_TOKEN_COUNTS_MODULE_ID, markdownTokenCountsPlugin } from "./markdown-token-counts.ts";

import type { MarkdownTokenCounts } from "./token-count.ts";

const MODULE_ID = "virtual:markdown-token-counts";
const TOKEN_COUNTS: MarkdownTokenCounts = { "/page.md": 607, "/collection.md": 145 };

// The plugin decides what to serve from the resolved command, so each test configures one.
const pluginFor = (command: "build" | "serve", loadTokenCounts = () => Promise.resolve(TOKEN_COUNTS)) => {
  const plugin = markdownTokenCountsPlugin(loadTokenCounts);

  (plugin.configResolved as unknown as (config: { command: string }) => void)({ command });

  return plugin;
};

const resolveIdHook = (command: "build" | "serve") =>
  pluginFor(command).resolveId as unknown as (source: string) => string | null;
const loadHook = (command: "build" | "serve", loadTokenCounts?: () => Promise<MarkdownTokenCounts>) =>
  pluginFor(command, loadTokenCounts).load as unknown as (id: string) => Promise<string | null>;

describe("markdownTokenCountsPlugin", () => {
  test("resolves its own module ID, and returns `null` for any other source", () => {
    const resolveId = resolveIdHook("build");

    expect(resolveId(MODULE_ID)).toBe(RESOLVED_MARKDOWN_TOKEN_COUNTS_MODULE_ID);
    expect(resolveId("virtual:other-module")).toBeNull();
  });

  test("serves the token counts the build recorded, and returns `null` for another module ID", async () => {
    const load = loadHook("build");

    expect(await load(RESOLVED_MARKDOWN_TOKEN_COUNTS_MODULE_ID)).toBe(
      `export const MARKDOWN_TOKEN_COUNTS = ${JSON.stringify(TOKEN_COUNTS)};`,
    );
    expect(await load("\0virtual:other-module")).toBeNull();
  });

  test("serves an empty map for a dev server", async () => {
    expect(await loadHook("serve")(RESOLVED_MARKDOWN_TOKEN_COUNTS_MODULE_ID)).toBe(
      "export const MARKDOWN_TOKEN_COUNTS = {};",
    );
  });

  test("does not measure token counts for a dev server", async () => {
    let measured = false;

    await loadHook("serve", () => {
      measured = true;
      return Promise.resolve(TOKEN_COUNTS);
    })(RESOLVED_MARKDOWN_TOKEN_COUNTS_MODULE_ID);

    expect(measured).toBe(false);
  });
});
