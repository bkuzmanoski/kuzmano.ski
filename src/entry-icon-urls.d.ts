/** The URL of each entry icon. */
declare module "virtual:entry-icon-urls" {
  import type { EntryKey } from "#/lib/content/entry-file.ts";

  export const ENTRY_ICON_URLS: Record<EntryKey, string | undefined>;
}
