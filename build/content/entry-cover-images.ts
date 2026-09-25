// This module imports only types and `../json-value-module.ts`, which also imports only types, so
// `/vitest.config.ts` can serve the module without reaching sharp through the media index.
import type { EntryKey } from "#/lib/content/entry-file.ts";
import type { CoverImage } from "#/lib/content/media.ts";

import { jsonValueModulePlugin, resolvedModuleIdOf } from "../json-value-module.ts";

import type { Plugin } from "vite";

const MODULE_ID = "virtual:entry-cover-images";

export const RESOLVED_ENTRY_COVER_IMAGES_MODULE_ID = resolvedModuleIdOf(MODULE_ID);

/**
 * Exposes entry cover images through `virtual:entry-cover-images`.
 *
 * The media plugin invalidates the module when a rebuilt index changes the cover images.
 */
export const entryCoverImagesPlugin = (loadCoverImages: () => Promise<Record<EntryKey, CoverImage>>): Plugin =>
  jsonValueModulePlugin({
    name: "kuzmano.ski:entry-cover-images",
    moduleId: MODULE_ID,
    exportName: "ENTRY_COVER_IMAGES",
    load: loadCoverImages,
  });
