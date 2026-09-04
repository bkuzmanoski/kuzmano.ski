import { useState } from "react";

import { STATE_DISPLAY_DURATION_MS } from "../tooltip.ts";

import { useTimer } from "./use-timer.ts";

type CopyState = "idle" | "copying" | "copied";

/** Writes a value to the clipboard and tracks the transient state a control displays while confirming the write. */
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
      setState("idle");
      onFailure();

      return;
    }

    setState("copied");
    timer.start(clearConfirmation, STATE_DISPLAY_DURATION_MS);
  }

  return { state, copy, clearConfirmation };
}
