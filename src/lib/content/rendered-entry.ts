import { createContext, use } from "react";

/** What the entry being rendered provides to the content inside it (not the entry itself). */
export interface RenderedEntry {
  route: string;
  reportCopyFailure: () => void;
}

export const RenderedEntryContext = createContext<RenderedEntry | null>(null);

export const useRenderedEntry = () => use(RenderedEntryContext);
