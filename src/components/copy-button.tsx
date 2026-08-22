import { useState } from "react";

import ConfirmedIcon from "#/assets/images/copy-confirmed.svg?react";
import CopyIcon from "#/assets/images/copy.svg?react";
import { useTimer } from "#/lib/hooks/use-timer";

import { Button } from "./button";
import styles from "./copy-button.module.css";
import { TAP_DISMISS_MS, Tooltip } from "./tooltip";

const CONFIRMATION_MS = TAP_DISMISS_MS + 100;

/** A `null` value means the text is not available yet, and the button waits for it. */
export function CopyButton({
  value,
  label,
  confirmation,
  className,
}: {
  value: string | null;
  label: string;
  confirmation: string;
  className?: string;
}) {
  const [isCopied, setIsCopied] = useState(false);
  const timer = useTimer();

  async function copy() {
    if (value === null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return; // Ignored.
    }

    setIsCopied(true);
    timer.start(() => setIsCopied(false), CONFIRMATION_MS);
  }

  return (
    <>
      <Tooltip label={isCopied ? confirmation : label} persistOnPress className={className}>
        <Button aria-label={label} disabled={value === null} variant="icon" onClick={() => void copy()}>
          {isCopied ? <ConfirmedIcon /> : <CopyIcon />}
        </Button>
      </Tooltip>
      <span className={styles.announcement} role="status">
        {isCopied ? confirmation : ""}
      </span>
    </>
  );
}
