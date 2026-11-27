import { createContext, use } from "react";

/** Context provided to an entry's rendered content (distinct from the entry record itself). */
export interface RenderedEntry {
  route: string;
}

export const RenderedEntryContext = createContext<RenderedEntry | null>(null);

export const useRenderedEntry = () => use(RenderedEntryContext);
