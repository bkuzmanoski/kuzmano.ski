import { useState } from "react";

import CopyButtonIcon from "#/assets/images/button-icon-copy.svg?react";
import LinkButtonIcon from "#/assets/images/button-icon-link.svg?react";
import Checkmark from "#/assets/images/checkmark.svg?react";
import { useCopyToClipboard } from "#/lib/hooks/use-copy-to-clipboard.ts";

import { Button } from "./button.tsx";
import { CopyFailureAlert } from "./copy-failure-alert.tsx";
import { CopyTooltip } from "./copy-tooltip.tsx";

const VARIANT_ICONS = { value: CopyButtonIcon, url: LinkButtonIcon };

export function CopyButton({
  value,
  entity,
  variant = "value",
  label = "Copy to clipboard",
  confirmation = "Copied",
  className,
}: {
  value: string | null;
  entity: string;
  variant?: keyof typeof VARIANT_ICONS;
  label?: string;
  confirmation?: string;
  className?: string;
}) {
  const [hasFailed, setHasFailed] = useState(false);
  const { state, copy, clearConfirmation } = useCopyToClipboard({ onFailure: () => setHasFailed(true) });
  const isCopied = state === "copied";
  const Icon = VARIANT_ICONS[variant];

  return (
    <>
      <CopyTooltip
        label={label}
        confirmation={confirmation}
        isCopied={isCopied}
        suppressed={value === null}
        onDidHide={clearConfirmation}
        className={className}
      >
        <Button
          variant="icon"
          disabled={value === null}
          holdPressed={state === "copying" || isCopied}
          aria-label={label}
          onClick={() => {
            if (value !== null) {
              void copy(value);
            }
          }}
        >
          {isCopied ? <Checkmark /> : <Icon />}
        </Button>
      </CopyTooltip>
      <CopyFailureAlert entity={entity} open={hasFailed} onDismiss={() => setHasFailed(false)} />
    </>
  );
}
