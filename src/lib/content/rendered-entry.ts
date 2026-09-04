import { createContext, use } from "react";

/** What the entry being rendered provides to the content inside it (not the entry itself). */
export interface RenderedEntry {
  route: string;
  reportCopyFailure: () => void;
}

export const RenderedEntryContext = createContext<RenderedEntry | null>(null);

/** The entry the calling component is rendered inside, or `null` outside one. */
export const useRenderedEntry = () => use(RenderedEntryContext);
