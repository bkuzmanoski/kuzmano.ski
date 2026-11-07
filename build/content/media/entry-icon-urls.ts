// Imports only types and `../../json-value-module.ts` because every test run loads this module through
// `/vitest.config.ts`.
import type { EntryKey } from "#/lib/content/entry-file.ts";

import { jsonValueModulePlugin, resolvedModuleIdOf } from "../../json-value-module.ts";

import type { Plugin } from "vite";

const MODULE_ID = "virtual:entry-icon-urls";

export const RESOLVED_ENTRY_ICON_URLS_MODULE_ID = resolvedModuleIdOf(MODULE_ID);

/**
 * Exposes the URLs of entry icons through `virtual:entry-icon-urls`.
 *
 * The media plugin invalidates the module when a rebuilt index changes the entry icon URLs.
 */
export const entryIconUrlsPlugin = (loadEntryIconUrls: () => Promise<Record<EntryKey, string>>): Plugin =>
  jsonValueModulePlugin({
    name: "kuzmano.ski:entry-icon-urls",
    moduleId: MODULE_ID,
    exportName: "ENTRY_ICON_URLS",
    load: loadEntryIconUrls,
  });
