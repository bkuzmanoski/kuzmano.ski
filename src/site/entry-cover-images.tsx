import { ENTRY_COVER_IMAGES } from "virtual:entry-cover-images";

import { EntryCoverImagesContext } from "#/lib/content/entry-cover-images.ts";

import type { ReactNode } from "react";

export function EntryCoverImagesProvider({ children }: { children: ReactNode }) {
  return <EntryCoverImagesContext value={ENTRY_COVER_IMAGES}>{children}</EntryCoverImagesContext>;
}
