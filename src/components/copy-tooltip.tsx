import styles from "./copy-tooltip.module.css";
import { Tooltip } from "./tooltip.tsx";

import type { ReactNode } from "react";

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
