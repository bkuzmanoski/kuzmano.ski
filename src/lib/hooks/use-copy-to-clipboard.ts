import { useState } from "react";

import { playError } from "#/lib/audio/sounds";
import { useTimer } from "#/lib/hooks/use-timer";
import { STATE_DISPLAY_DURATION_MS } from "#/lib/tooltip";

type CopyState = "idle" | "copying" | "copied"; // `copying` lasts until the clipboard write settles, so a control can remain pressed during the write

/**
 * Writes a value to the clipboard and tracks the transient state a control displays while
 * confirming the write.
 *
 * Only the successful outcome is kept as state here: it is brief and expires on its own, and a
 * control showing it through a tooltip has no pointer event to clear that tooltip. A failed write
 * needs to remain visible until it is acknowledged, so `onFailure` lets the component that owns
 * the alert decide how to display and clear it.
 */
export function useCopyToClipboard({ onFailure }: { onFailure: () => void }) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useTimer();

  function clearConfirmation() {
    timer.cancel();
    setState((current) => (current === "copied" ? "idle" : current));
  }

  async function copy(value: string) {
    setState("copying");

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      playError();
      setState("idle");
      onFailure();

      return;
    }

    setState("copied");
    timer.start(clearConfirmation, STATE_DISPLAY_DURATION_MS);
  }

  return { state, copy, clearConfirmation };
}
