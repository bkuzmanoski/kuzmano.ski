import { createContext, use } from "react";

import type { ClipboardCopyStatus } from "#/lib/hooks/use-copy-to-clipboard.ts";

/**
 * The clipboard every heading link and code block in an entry copies through, which the entry owns, so
 * it confirms one copy at a time and announces it from one status region rather than one per control
 * (see `EntryClipboardProvider`). A control identifies itself by an ID unique among the entry's copy
 * controls.
 *
 * Only the copy controls read it, so a copy re-renders them and not the rest of the entry.
 */
export interface EntryClipboard {
  copyStatusOf: (copyControlId: string) => ClipboardCopyStatus | null; // `null` for every control but the one that made the latest copy.
  copyToClipboard: (copyControlId: string, value: string, entity: string) => void; // `entity` names the value in the failure alert.
  clearCopyConfirmationOf: (copyControlId: string) => void; // Leaves the confirmation of a later copy from another control in place.
}

export const EntryClipboardContext = createContext<EntryClipboard | null>(null);

export const useEntryClipboard = () => use(EntryClipboardContext);
