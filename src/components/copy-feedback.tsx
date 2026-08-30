import { Alert } from "./alert";
import styles from "./copy-feedback.module.css";
import { Tooltip } from "./tooltip";

import type { ReactNode } from "react";

const failureMessage = (entity: string) => `The ${entity} couldn’t be copied. Check your browser permissions.`;

/** The tooltip and screen-reader announcement for a copy control. */
export function CopyTooltip({
  label,
  confirmation,
  margin,
  isCopied,
  suppressed = false,
  onDidHide,
  className,
  children,
}: {
  label: string;
  confirmation: string;
  margin?: number;
  isCopied: boolean;
  suppressed?: boolean;
  onDidHide: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <>
      <Tooltip
        label={isCopied ? confirmation : label}
        margin={margin}
        persistOnPress
        showsState={isCopied}
        suppressed={suppressed}
        onDidHide={onDidHide}
        className={className}
      >
        {children}
      </Tooltip>
      <span className={styles.announcement} role="status">
        {isCopied ? confirmation : ""}
      </span>
    </>
  );
}

/** The alert raised when a copy fails. */
export function CopyFailureAlert({
  entity,
  open,
  onDismiss,
}: {
  entity: string;
  open: boolean;
  onDismiss: () => void;
}) {
  return (
    <Alert
      variant="error"
      message={failureMessage(entity)}
      open={open}
      primaryAction={{ label: "OK", onAction: onDismiss }}
    />
  );
}
