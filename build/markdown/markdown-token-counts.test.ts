import { describe, expect, test } from "vitest";

import { hookOf } from "../test-utils/plugin-hooks.ts";

import { RESOLVED_MARKDOWN_TOKEN_COUNTS_MODULE_ID, markdownTokenCountsPlugin } from "./markdown-token-counts.ts";

import type { MarkdownTokenCounts } from "./token-count.ts";
import type { LoadHook, ResolveIdHook } from "../test-utils/plugin-hooks.ts";

const MODULE_ID = "virtual:markdown-token-counts";
const TOKEN_COUNTS: MarkdownTokenCounts = { "/page.md": 607, "/collection.md": 145 };

const loadedModuleFor = (
  command: "build" | "serve", // The module the plugin serves depends on the command of the environment that loads it.
  loadTokenCounts: () => Promise<MarkdownTokenCounts> = () => Promise.resolve(TOKEN_COUNTS),
) =>
  hookOf<LoadHook<{ environment: { config: { command: string } } }>>(
    markdownTokenCountsPlugin(loadTokenCounts),
    "load",
  ).call({ environment: { config: { command } } }, RESOLVED_MARKDOWN_TOKEN_COUNTS_MODULE_ID);

describe("markdownTokenCountsPlugin", () => {
  test("resolves its own module ID", () => {
    const resolveId = hookOf<ResolveIdHook>(
      markdownTokenCountsPlugin(() => Promise.resolve(TOKEN_COUNTS)),
      "resolveId",
    );
    expect(resolveId(MODULE_ID)).toBe(RESOLVED_MARKDOWN_TOKEN_COUNTS_MODULE_ID);
  });

  test("serves the token counts the build recorded", async () => {
    expect(await loadedModuleFor("build")).toBe(
      `export const MARKDOWN_TOKEN_COUNTS = ${JSON.stringify(TOKEN_COUNTS)};`,
    );
  });

  test("serves an empty map for a dev server", async () => {
    expect(await loadedModuleFor("serve")).toBe("export const MARKDOWN_TOKEN_COUNTS = {};");
  });

  test("does not measure token counts for a dev server", async () => {
    let measured = false;

    await loadedModuleFor("serve", () => {
      measured = true;
      return Promise.resolve(TOKEN_COUNTS);
    });

    expect(measured).toBe(false);
  });
});
