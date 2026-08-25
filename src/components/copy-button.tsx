import { useState } from "react";

import CheckmarkIcon from "#/assets/images/checkmark.svg?react";
import CopyIcon from "#/assets/images/copy.svg?react";
import { playError } from "#/lib/audio/sounds";
import { useTimer } from "#/lib/hooks/use-timer";

import { Alert } from "./alert";
import { Button } from "./button";
import styles from "./copy-button.module.css";
import { TAP_DISMISS_MS, Tooltip } from "./tooltip";

const CONFIRMATION_MS = TAP_DISMISS_MS + 100;
const failureMessage = (entity: string) => `The ${entity} couldn’t be copied. Check your browser permissions.`;

type State = "idle" | "copying" | "copied" | "failed";

/** A `null` value means the text is not available yet, and the button waits for it. */
export function CopyButton({
  value,
  entity,
  label,
  confirmation,
  className,
}: {
  value: string | null;
  entity: string;
  label: string;
  confirmation: string;
  className?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const timer = useTimer();
  const isCopied = state === "copied";

  async function copy() {
    if (value === null) {
      return;
    }

    setState("copying");

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      playError();
      setState("failed");

      return;
    }

    setState("copied");
    timer.start(() => setState("idle"), CONFIRMATION_MS);
  }

  return (
    <>
      <Tooltip label={isCopied ? confirmation : label} suppressed={value === null} persistOnPress className={className}>
        <Button
          variant="icon"
          aria-label={label}
          disabled={value === null}
          holdPressed={state === "copying" || isCopied}
          onClick={() => void copy()}
        >
          {isCopied ? <CheckmarkIcon /> : <CopyIcon />}
        </Button>
      </Tooltip>
      <span className={styles.announcement} role="status">
        {isCopied ? confirmation : ""}
      </span>
      <Alert
        variant="error"
        message={failureMessage(entity)}
        open={state === "failed"}
        primaryAction={{ label: "OK", onAction: () => setState("idle") }}
      />
    </>
  );
}
