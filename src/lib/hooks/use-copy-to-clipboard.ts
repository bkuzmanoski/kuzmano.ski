import { useEffect, useRef, useState } from "react";

import { STATE_DISPLAY_DURATION_MS } from "../tooltip.ts";

export type ClipboardCopyStatus = "copying" | "copied" | "failed";
export type ClipboardCopy<TDetails extends object> = TDetails & {
  id: number; // Unique among the copies of one `useCopyToClipboard`.
  status: ClipboardCopyStatus;
};

/**
 * Writes values to the clipboard and returns the latest copy, which a control displays while its write
 * is pending, confirmed, or failed, or `null` when there is no copy to display.
 *
 * Each copy replaces the one before it, and a write's status is applied only while the copy that
 * started the write is still the latest. A write that finishes after a later copy has started
 * therefore does not confirm or fail the later copy, whichever finishes first. A confirmation ends
 * `STATE_DISPLAY_DURATION_MS` after the write, or earlier through `clearConfirmation`, and a failure
 * ends through `dismissFailure`.
 */
export function useCopyToClipboard<TDetails extends object = Record<never, never>>() {
  const [latestClipboardCopy, setLatestClipboardCopy] = useState<ClipboardCopy<TDetails> | null>(null);
  const clipboardCopyCountRef = useRef(0);
  const confirmedClipboardCopyId = latestClipboardCopy?.status === "copied" ? latestClipboardCopy.id : null;

  useEffect(() => {
    if (confirmedClipboardCopyId === null) {
      return;
    }

    const timeout = setTimeout(() => {
      setLatestClipboardCopy((current) => (current?.id === confirmedClipboardCopyId ? null : current));
    }, STATE_DISPLAY_DURATION_MS);

    return () => clearTimeout(timeout);
  }, [confirmedClipboardCopyId]);

  async function copy(value: string, details: TDetails) {
    clipboardCopyCountRef.current += 1;

    const id = clipboardCopyCountRef.current;

    let status: ClipboardCopyStatus;

    setLatestClipboardCopy({ ...details, id, status: "copying" });

    try {
      await navigator.clipboard.writeText(value);
      status = "copied";
    } catch {
      status = "failed";
    }

    setLatestClipboardCopy((current) => (current?.id === id ? { ...current, status } : current));
  }

  // Ends the confirmation of the latest clipboard copy when `isClipboardCopyToClear` accepts it, for a control whose
  // tooltip stopped displaying the confirmation before it ended.
  function clearConfirmation(isClipboardCopyToClear: (copy: ClipboardCopy<TDetails>) => boolean = () => true) {
    setLatestClipboardCopy((current) =>
      current?.status === "copied" && isClipboardCopyToClear(current) ? null : current,
    );
  }

  function dismissFailure() {
    setLatestClipboardCopy((current) => (current?.status === "failed" ? null : current));
  }

  return { latestClipboardCopy, copy, clearConfirmation, dismissFailure };
}
