import { CopyFailureAlert } from "#/components/copy-failure-alert.tsx";
import { useCopyToClipboard } from "#/lib/hooks/use-copy-to-clipboard.ts";

import styles from "./content-body.module.css";
import { EntryClipboardContext } from "./entry-clipboard.ts";

import type { EntryClipboard } from "./entry-clipboard.ts";
import type { ReactNode } from "react";

/**
 * Provides the entry's clipboard to its copy controls, and renders the status region and the failure
 * alert they share after the entry's content.
 *
 * The confirmation in the status region is keyed by the copy's ID, so a copy made while the last one's
 * confirmation is still shown inserts it again, which a screen reader announces as a new status. The
 * entry, rather than the control, ends the confirmation, so a control that unmounts during its
 * confirmation does not leave the confirmation in the region.
 */
export function EntryClipboardProvider({ children }: { children: ReactNode }) {
  const { latestClipboardCopy, copy, clearConfirmation, dismissFailure } = useCopyToClipboard<{
    copyControlId: string;
    entity: string; // What the control copies, as shown in the failure alert.
  }>();

  const entryClipboard: EntryClipboard = {
    copyStatusOf: (copyControlId) =>
      latestClipboardCopy?.copyControlId === copyControlId ? latestClipboardCopy.status : null,
    copyToClipboard: (copyControlId, value, entity) => void copy(value, { copyControlId, entity }),
    clearCopyConfirmationOf: (copyControlId) =>
      clearConfirmation((clipboardCopy) => clipboardCopy.copyControlId === copyControlId),
  };

  return (
    <EntryClipboardContext value={entryClipboard}>
      {children}
      <span className={styles.entryCopyStatus} role="status">
        {latestClipboardCopy?.status === "copied" && <span key={latestClipboardCopy.id}>Copied</span>}
      </span>
      <CopyFailureAlert
        entity={latestClipboardCopy?.entity ?? ""}
        open={latestClipboardCopy?.status === "failed"}
        onDismiss={dismissFailure}
      />
    </EntryClipboardContext>
  );
}
