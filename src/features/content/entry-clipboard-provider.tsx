import { CopyFailureAlert } from "#/components/copy-failure-alert.tsx";
import { useCopyToClipboard } from "#/lib/hooks/use-copy-to-clipboard.ts";

import styles from "./content-body.module.css";
import { EntryClipboardContext } from "./entry-clipboard.ts";

import type { EntryClipboard } from "./entry-clipboard.ts";
import type { ReactNode } from "react";

/**
 * Shares clipboard state with an entry's copy controls and renders their status region and failure alert.
 *
 * Keying confirmations by copy ID causes subsequent copies to be announced as new status updates. The
 * provider clears confirmations so they are removed even if the originating control unmounts.
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
