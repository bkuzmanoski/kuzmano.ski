/** Client build chunks and stylesheets loaded by each entry. */
declare module "virtual:entry-body-chunks" {
  import type { EntryBodyChunks } from "#/lib/content/catalog.ts";
  import type { EntryKey } from "#/lib/content/entry-file.ts";

  export const ENTRY_BODY_CHUNKS: Record<EntryKey, EntryBodyChunks | undefined>;
}
