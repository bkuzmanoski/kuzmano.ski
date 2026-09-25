// This module imports only types and `../json-value-module.ts`, which also imports only types, so
// `/vitest.config.ts` can serve the module without reaching the content tree.
import { jsonValueModulePlugin, resolvedModuleIdOf } from "../json-value-module.ts";

import type { MarkdownTokenCounts } from "./token-count.ts";
import type { Plugin } from "vite";

const MODULE_ID = "virtual:markdown-token-counts";

export const RESOLVED_MARKDOWN_TOKEN_COUNTS_MODULE_ID = resolvedModuleIdOf(MODULE_ID);

/**
 * Exposes build-time Markdown token counts through `virtual:markdown-token-counts`.
 *
 * The Worker reads this map to identify which paths have a Markdown representation, and to report a
 * token count without reading the body. In development, the map remains empty because `./plugin.ts`
 * renders and counts tokens per request.
 */
export const markdownTokenCountsPlugin = (loadTokenCounts: () => Promise<MarkdownTokenCounts>): Plugin =>
  jsonValueModulePlugin({
    name: "kuzmano.ski:markdown-token-counts",
    moduleId: MODULE_ID,
    exportName: "MARKDOWN_TOKEN_COUNTS",
    load: async ({ config }) => (config.command === "build" ? await loadTokenCounts() : {}),
  });
