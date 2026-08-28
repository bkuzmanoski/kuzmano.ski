import { useState } from "react";

import CheckmarkIcon from "#/assets/images/checkmark.svg?react";
import CopyIcon from "#/assets/images/copy.svg?react";
import LinkIcon from "#/assets/images/link.svg?react";
import { playError } from "#/lib/audio/sounds";
import { useTimer } from "#/lib/hooks/use-timer";
import { STATE_DISPLAY_DURATION_MS } from "#/lib/tooltip";

import { Alert } from "./alert";
import { Button } from "./button";
import styles from "./copy-button.module.css";
import { Tooltip } from "./tooltip";

type State = "idle" | "copying" | "copied" | "failed";

const icons = { copy: CopyIcon, link: LinkIcon };

const failureMessage = (entity: string) => `The ${entity} couldn’t be copied. Check your browser permissions.`;

/** The button is disabled until the value is available. */
export function CopyButton({
  value,
  entity,
  variant = "copy",
  label = "Copy to clipboard",
  confirmation = "Copied",
  className,
}: {
  value: string | null;
  entity: string;
  variant?: keyof typeof icons;
  label?: string;
  confirmation?: string;
  className?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const timer = useTimer();

  const Icon = icons[variant];
  const isCopied = state === "copied";

  // The confirmation stands until it is read, so it clears on its own delay, or as soon as the
  // tooltip carrying it leaves the screen. A failed copy is left alone: its alert waits on the
  // user, not the press.
  function clearConfirmation() {
    timer.cancel();
    setState((current) => (current === "copied" ? "idle" : current));
  }

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
    timer.start(clearConfirmation, STATE_DISPLAY_DURATION_MS);
  }

  return (
    <>
      <Tooltip
        label={isCopied ? confirmation : label}
        persistOnPress
        showsState={isCopied}
        suppressed={value === null}
        onDidHide={clearConfirmation}
        className={className}
      >
        <Button
          variant="icon"
          aria-label={label}
          disabled={value === null}
          holdPressed={state === "copying" || isCopied}
          onClick={() => void copy()}
        >
          {isCopied ? <CheckmarkIcon /> : <Icon />}
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
