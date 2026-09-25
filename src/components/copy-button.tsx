import CopyButtonIcon from "#/assets/images/button-icon-copy.svg?react";
import LinkButtonIcon from "#/assets/images/button-icon-link.svg?react";
import Checkmark from "#/assets/images/checkmark.svg?react";
import { useCopyToClipboard } from "#/lib/hooks/use-copy-to-clipboard.ts";
import type { ClipboardCopyStatus } from "#/lib/hooks/use-copy-to-clipboard.ts";

import { Button } from "./button.tsx";
import { CopyFailureAlert } from "./copy-failure-alert.tsx";
import { CopyTooltip } from "./copy-tooltip.tsx";

const VARIANT_ICONS = { value: CopyButtonIcon, url: LinkButtonIcon };

interface CopyButtonAppearance {
  variant?: keyof typeof VARIANT_ICONS;
  label?: string;
  confirmation?: string;
  className?: string;
}

/**
 * A control that copies `value`, confirms the copy, and announces it from a status region of its own.
 * Where several controls share one status region, each renders a `ControlledCopyButton` instead.
 */
export function CopyButton({
  value,
  entity,
  ...appearance
}: CopyButtonAppearance & { value: string | null; entity: string }) {
  const { latestClipboardCopy, copy, clearConfirmation, dismissFailure } = useCopyToClipboard();
  return (
    <>
      <ControlledCopyButton
        copyStatus={latestClipboardCopy?.status ?? null}
        disabled={value === null}
        announcesConfirmation
        onCopy={() => {
          if (value !== null) {
            void copy(value, {});
          }
        }}
        onDidHide={() => clearConfirmation()}
        {...appearance}
      />
      <CopyFailureAlert entity={entity} open={latestClipboardCopy?.status === "failed"} onDismiss={dismissFailure} />
    </>
  );
}

/**
 * A copy control whose copy, confirmation, and failure alert are owned by its caller, which passes the
 * status of the latest copy the control made as `copyStatus`, or `null` when there is none to display.
 * `onDidHide` is called when the control's tooltip is hidden, for the caller to end the confirmation
 * the tooltip was showing.
 */
export function ControlledCopyButton({
  copyStatus,
  disabled,
  announcesConfirmation,
  variant = "value",
  label = "Copy to clipboard",
  confirmation = "Copied",
  className,
  onCopy,
  onDidHide,
}: CopyButtonAppearance & {
  copyStatus: ClipboardCopyStatus | null;
  disabled: boolean;
  announcesConfirmation: boolean;
  onCopy: () => void;
  onDidHide: () => void;
}) {
  const isCopied = copyStatus === "copied";
  const Icon = VARIANT_ICONS[variant];

  return (
    <CopyTooltip
      label={label}
      confirmation={confirmation}
      isCopied={isCopied}
      suppressed={disabled}
      announcesConfirmation={announcesConfirmation}
      onDidHide={onDidHide}
      className={className}
    >
      <Button
        variant="icon"
        disabled={disabled}
        holdPressed={copyStatus === "copying" || isCopied}
        aria-label={label}
        onClick={onCopy}
      >
        {isCopied ? <Checkmark /> : <Icon />}
      </Button>
    </CopyTooltip>
  );
}
