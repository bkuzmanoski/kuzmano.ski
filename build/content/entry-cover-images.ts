import type { EntryKey } from "#/lib/content/entry-file.ts";
import type { CoverImage } from "#/lib/content/media.ts";

import type { Plugin } from "vite";

// Imports only types, so `/vitest.config.ts` can serve the module without reaching sharp through the
// media index. `/src/entry-cover-images.d.ts` declares its export.

const MODULE_ID = "virtual:entry-cover-images";

export const RESOLVED_ENTRY_COVER_IMAGES_MODULE_ID = `\0${MODULE_ID}`;

/** Serves `virtual:entry-cover-images`, which exports the cover image of each entry that has one. */
export function entryCoverImagesPlugin(loadCoverImages: () => Promise<Record<EntryKey, CoverImage>>): Plugin {
  return {
    name: "kuzmano.ski:entry-cover-images",
    enforce: "pre",
    resolveId: (source) => (source === MODULE_ID ? RESOLVED_ENTRY_COVER_IMAGES_MODULE_ID : null),
    async load(id) {
      if (id !== RESOLVED_ENTRY_COVER_IMAGES_MODULE_ID) {
        return null;
      }

      return `export const ENTRY_COVER_IMAGES = ${JSON.stringify(await loadCoverImages())};`;
    },
  };
}
