import CopyButtonIcon from "#/assets/images/button-icon-copy.svg?react";
import LinkButtonIcon from "#/assets/images/button-icon-link.svg?react";
import Checkmark from "#/assets/images/checkmark.svg?react";
import { useCopyToClipboard } from "#/lib/hooks/use-copy-to-clipboard.ts";
import type { ClipboardCopyStatus } from "#/lib/hooks/use-copy-to-clipboard.ts";

import { ActionFailureAlert } from "./action-failure-alert.tsx";
import { Button } from "./button.tsx";
import { COPY_CONFIRMATION, CopyAnnouncer } from "./copy-announcer.tsx";
import { CopyTooltip } from "./copy-tooltip.tsx";

import type { IconButtonVariant } from "./button.tsx";

const COPY_ICONS = { value: CopyButtonIcon, url: LinkButtonIcon };

interface CopyButtonAppearance {
  icon?: keyof typeof COPY_ICONS;
  variant?: IconButtonVariant;
  label?: string;
  confirmation?: string;
  className?: string;
}

/**
 * A control that copies `value`, confirms the copy, and announces it from a status region of its own. Where several
 * controls share one status region, each renders a `ControlledCopyButton` instead.
 */
export function CopyButton({
  value,
  entity,
  confirmation = COPY_CONFIRMATION,
  ...appearance
}: CopyButtonAppearance & { value: string | null; entity: string }) {
  const { latestClipboardCopy, confirmedClipboardCopyNumber, copy, clearConfirmation, dismissFailure } =
    useCopyToClipboard();
  return (
    <>
      <ControlledCopyButton
        copyStatus={latestClipboardCopy?.status ?? null}
        disabled={value === null}
        confirmation={confirmation}
        onCopy={() => {
          if (value !== null) {
            void copy(value, {});
          }
        }}
        onDidHide={() => clearConfirmation()}
        {...appearance}
      />
      <CopyAnnouncer confirmedClipboardCopyNumber={confirmedClipboardCopyNumber} confirmation={confirmation} />
      <ActionFailureAlert
        action="copy"
        isPermissionDenied
        entity={entity}
        open={latestClipboardCopy?.status === "failed"}
        onDismiss={dismissFailure}
      />
    </>
  );
}

/**
 * A copy control whose caller owns its copy, its `CopyAnnouncer`, and its failure alert, and passes the status of the
 * latest copy the control made as `copyStatus`, or `null` when there is none to display. The control calls `onDidHide`
 * when its tooltip hides, for the caller to end the confirmation the tooltip was showing.
 */
export function ControlledCopyButton({
  copyStatus,
  disabled,
  icon = "value",
  variant = "standalone",
  label = "Copy to Clipboard",
  confirmation = COPY_CONFIRMATION,
  className,
  onCopy,
  onDidHide,
}: CopyButtonAppearance & {
  copyStatus: ClipboardCopyStatus | null;
  disabled: boolean;
  onCopy: () => void;
  onDidHide: () => void;
}) {
  const isCopying = copyStatus === "copying";
  const hasCopied = copyStatus === "copied";

  const Icon = COPY_ICONS[icon];

  return (
    <CopyTooltip
      label={label}
      confirmation={confirmation}
      hasCopied={hasCopied}
      suppressed={disabled}
      onDidHide={onDidHide}
      className={className}
    >
      <Button
        variant={variant}
        disabled={disabled}
        holdPressed={isCopying || hasCopied}
        aria-label={label}
        onClick={() => {
          // Copying again would show the copy icon and its label until the new write finished, then restart the
          // confirmation, so a press while a copy is pending or confirmed is ignored.
          if (!isCopying && !hasCopied) {
            onCopy();
          }
        }}
      >
        {hasCopied ? <Checkmark /> : <Icon />}
      </Button>
    </CopyTooltip>
  );
}
