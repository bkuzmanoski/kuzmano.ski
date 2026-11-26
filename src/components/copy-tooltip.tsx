import { Tooltip } from "./tooltip.tsx";

import type { ReactNode } from "react";

/**
 * The tooltip of a copy control, which shows `confirmation` in place of `label` while `hasCopied`. The owner of the
 * control's `useCopyToClipboard` renders the `CopyAnnouncer` that announces the copy.
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
