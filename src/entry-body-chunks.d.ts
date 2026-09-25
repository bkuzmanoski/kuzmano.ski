/** The chunks and stylesheets each entry loads in the client build. */
declare module "virtual:entry-body-chunks" {
  import type { EntryBodyChunks } from "#/lib/content/catalog.ts";
  import type { EntryKey } from "#/lib/content/entry-file.ts";

  export const ENTRY_BODY_CHUNKS: Record<EntryKey, EntryBodyChunks | undefined>;
}
