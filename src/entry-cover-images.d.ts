/** The cover image of each entry that has one. */
declare module "virtual:entry-cover-images" {
  import type { EntryKey } from "#/lib/content/entry-file.ts";
  import type { CoverImage } from "#/lib/content/media.ts";

  export const ENTRY_COVER_IMAGES: Record<EntryKey, CoverImage | undefined>;
}
