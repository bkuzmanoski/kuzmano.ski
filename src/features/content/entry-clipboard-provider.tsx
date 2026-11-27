import { ActionFailureAlert } from "#/components/action-failure-alert.tsx";
import { CopyAnnouncer } from "#/components/copy-announcer.tsx";
import { useCopyToClipboard } from "#/lib/hooks/use-copy-to-clipboard.ts";

import { EntryClipboardContext } from "./entry-clipboard.ts";

import type { EntryClipboard } from "./entry-clipboard.ts";
import type { ReactNode } from "react";

/**
 * Shares clipboard state with an entry's copy controls and renders their `CopyAnnouncer` and failure alert.
 *
 * The provider owns the latest copy, so its confirmation ends even when the control that made the copy unmounts.
 */
export function EntryClipboardProvider({ children }: { children: ReactNode }) {
  const { latestClipboardCopy, confirmedClipboardCopyNumber, copy, clearConfirmation, dismissFailure } =
    useCopyToClipboard<{
      copyControlId: string;
      /** Label for the copied content, shown in the failure alert. */
      entity: string;
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
      <CopyAnnouncer confirmedClipboardCopyNumber={confirmedClipboardCopyNumber} />
      <ActionFailureAlert
        action="copy"
        isPermissionDenied
        entity={latestClipboardCopy?.entity ?? ""}
        open={latestClipboardCopy?.status === "failed"}
        onDismiss={dismissFailure}
      />
    </EntryClipboardContext>
  );
}
