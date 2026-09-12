/** The URL of each entry's client chunk. */
declare module "virtual:entry-body-chunks" {
  import type { EntryKey } from "#/lib/content/entry-file.ts";

  export const ENTRY_BODY_CHUNKS: Record<EntryKey, string | undefined>;
}
