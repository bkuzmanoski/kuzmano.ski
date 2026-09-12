import { createContext, use } from "react";

import type { EntryKey } from "./entry-file.ts";
import type { CoverImage } from "./media.ts";

/** The cover image of each entry that has one, keyed by entry key. */
export type EntryCoverImages = Record<EntryKey, CoverImage | undefined>;

export const EntryCoverImagesContext = createContext<EntryCoverImages>({});

export const useEntryCoverImage = (key: EntryKey): CoverImage | null => use(EntryCoverImagesContext)[key] ?? null;
