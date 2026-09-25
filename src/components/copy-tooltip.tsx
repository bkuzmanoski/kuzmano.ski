import styles from "./copy-tooltip.module.css";
import { Tooltip } from "./tooltip.tsx";

import type { ReactNode } from "react";

/**
 * The tooltip and screen-reader announcement for a copy control. A control whose copy is announced by
 * a status region it shares with other controls, such as an entry's copy status, sets
 * `announcesConfirmation` to `false`, so a page does not contain a status region per control. It is
 * required, so each control states which region announces its copy.
 */
export function CopyTooltip({
  label,
  confirmation,
  margin,
  isCopied,
  suppressed = false,
  announcesConfirmation,
  onDidHide,
  className,
  children,
}: {
  label: string;
  confirmation: string;
  margin?: number;
  isCopied: boolean;
  suppressed?: boolean;
  announcesConfirmation: boolean;
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
      {announcesConfirmation && (
        <span className={styles.announcement} role="status">
          {isCopied ? confirmation : ""}
        </span>
      )}
    </>
  );
}
