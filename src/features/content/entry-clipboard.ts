import { createContext, use } from "react";

import type { ClipboardCopyStatus } from "#/lib/hooks/use-copy-to-clipboard.ts";

/**
 * Shared clipboard state for heading links, code blocks, and the entry copy control.
 *
 * Tracks and announces a single copy confirmation at a time through the shared status region
 * (`EntryClipboardProvider`). Each control supplies an ID unique within the entry.
 *
 * Because only copy controls consume this context, copying avoids re-rendering the rest of the entry.
 */
export interface EntryClipboard {
  /** `null` for every control but the one that made the latest copy. */
  copyStatusOf: (copyControlId: string) => ClipboardCopyStatus | null;
  /** `entity` names the value in the failure alert. */
  copyToClipboard: (copyControlId: string, value: string, entity: string) => void;
  /** Leaves the confirmation of a later copy from another control in place. */
  clearCopyConfirmationOf: (copyControlId: string) => void;
}

export const EntryClipboardContext = createContext<EntryClipboard | null>(null);

export const useEntryClipboard = () => use(EntryClipboardContext);
