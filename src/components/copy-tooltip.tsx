import { Tooltip } from "./tooltip.tsx";

import type { ReactNode } from "react";

/**
 * Tooltip for a copy control that swaps `label` for `confirmation` while `hasCopied`. The caller renders
 * `CopyAnnouncer` separately.
 */
export function CopyTooltip({
  label,
  confirmation,
  margin,
  hasCopied,
  suppressed = false,
  onDidHide,
  className,
  children,
}: {
  label: string;
  confirmation: string;
  margin?: number;
  hasCopied: boolean;
  suppressed?: boolean;
  onDidHide: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip
      label={hasCopied ? confirmation : label}
      margin={margin}
      persistOnPress
      showsState={hasCopied}
      suppressed={suppressed}
      onDidHide={onDidHide}
      className={className}
    >
      {children}
    </Tooltip>
  );
}
