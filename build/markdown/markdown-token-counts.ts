// Imports only types, so `/vitest.config.ts` can serve the module without reaching the content tree.
// `/src/markdown-token-counts.d.ts` declares its export.

import type { MarkdownTokenCounts } from "./token-count.ts";
import type { Plugin } from "vite";

const MODULE_ID = "virtual:markdown-token-counts";

export const RESOLVED_MARKDOWN_TOKEN_COUNTS_MODULE_ID = `\0${MODULE_ID}`;

/**
 * Exposes build-time Markdown token counts through `virtual:markdown-token-counts`.
 *
 * The Worker reads this map to identify which paths have a Markdown representation, and to report a
 * token count without reading the body. In development, the map remains empty because `./plugin.ts`
 * renders and counts tokens per request.
 */
export function markdownTokenCountsPlugin(loadTokenCounts: () => Promise<MarkdownTokenCounts>): Plugin {
  let isBuild = false;
  return {
    name: "kuzmano.ski:markdown-token-counts",
    enforce: "pre",
    configResolved: (config) => void (isBuild = config.command === "build"),
    resolveId: (source) => (source === MODULE_ID ? RESOLVED_MARKDOWN_TOKEN_COUNTS_MODULE_ID : null),
    async load(id) {
      if (id !== RESOLVED_MARKDOWN_TOKEN_COUNTS_MODULE_ID) {
        return null;
      }

      return `export const MARKDOWN_TOKEN_COUNTS = ${JSON.stringify(isBuild ? await loadTokenCounts() : {})};`;
    },
  };
}
