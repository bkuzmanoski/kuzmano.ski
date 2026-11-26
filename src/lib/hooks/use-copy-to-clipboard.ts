import { useEffect, useRef, useState } from "react";

import { STATE_DISPLAY_DURATION_MS } from "../tooltip.ts";

export type ClipboardCopyStatus = "copying" | "copied" | "failed";
export type ClipboardCopy<TDetails extends object> = TDetails & {
  /** Unique among the copies of one `useCopyToClipboard`. */
  id: number;
  status: ClipboardCopyStatus;
};

/**
 * Writes values to the clipboard and returns the latest copy, which a control displays while its write is pending,
 * confirmed, or failed, or `null` when there is no copy to display. `confirmedClipboardCopyNumber` counts confirmed
 * copies from `1` while the latest copy's confirmation lasts, skipping failed or superseded copies, or is `null`. In a
 * secure context, where `navigator.clipboard` exists, `clipboard.writeText` rejects only for a denied write, so a
 * failed copy means a denied permission.
 *
 * Each copy replaces the one before it, and a write's status is applied only while the copy that started the write is
 * still the latest. A write that finishes after a later copy has started therefore does not confirm or fail the later
 * copy, whichever finishes first. A confirmation ends `STATE_DISPLAY_DURATION_MS` after the write, or earlier through
 * `clearConfirmation`, and a failure ends through `dismissFailure`.
 */
export function useCopyToClipboard<TDetails extends object = Record<never, never>>() {
  const [clipboardState, setClipboardState] = useState<{
    latestClipboardCopy: ClipboardCopy<TDetails> | null;
    confirmedClipboardCopyCount: number;
  }>({ latestClipboardCopy: null, confirmedClipboardCopyCount: 0 });
  const clipboardCopyCountRef = useRef(0);
  const { latestClipboardCopy, confirmedClipboardCopyCount } = clipboardState;
  const confirmedClipboardCopyId = latestClipboardCopy?.status === "copied" ? latestClipboardCopy.id : null;
  const confirmedClipboardCopyNumber = confirmedClipboardCopyId !== null ? confirmedClipboardCopyCount : null;

  useEffect(() => {
    if (confirmedClipboardCopyId === null) {
      return;
    }

    const timeout = setTimeout(() => {
      setClipboardState((current) =>
        current.latestClipboardCopy?.id === confirmedClipboardCopyId
          ? { ...current, latestClipboardCopy: null }
          : current,
      );
    }, STATE_DISPLAY_DURATION_MS);

    return () => clearTimeout(timeout);
  }, [confirmedClipboardCopyId]);

  async function copy(value: string, details: TDetails) {
    clipboardCopyCountRef.current += 1;

    const id = clipboardCopyCountRef.current;

    let status: ClipboardCopyStatus;

    setClipboardState((current) => ({ ...current, latestClipboardCopy: { ...details, id, status: "copying" } }));

    try {
      await navigator.clipboard.writeText(value);
      status = "copied";
    } catch {
      status = "failed";
    }

    setClipboardState((current) => {
      if (current.latestClipboardCopy?.id !== id) {
        return current;
      }

      return {
        latestClipboardCopy: { ...current.latestClipboardCopy, status },
        confirmedClipboardCopyCount:
          status === "copied" ? current.confirmedClipboardCopyCount + 1 : current.confirmedClipboardCopyCount,
      };
    });
  }

  // Ends the confirmation of the latest clipboard copy when `isClipboardCopyToClear` accepts it, for a control whose
  // tooltip stopped displaying the confirmation before it ended.
  function clearConfirmation(isClipboardCopyToClear: (copy: ClipboardCopy<TDetails>) => boolean = () => true) {
    setClipboardState((current) =>
      current.latestClipboardCopy?.status === "copied" && isClipboardCopyToClear(current.latestClipboardCopy)
        ? { ...current, latestClipboardCopy: null }
        : current,
    );
  }

  function dismissFailure() {
    setClipboardState((current) =>
      current.latestClipboardCopy?.status === "failed" ? { ...current, latestClipboardCopy: null } : current,
    );
  }

  return { latestClipboardCopy, confirmedClipboardCopyNumber, copy, clearConfirmation, dismissFailure };
}
