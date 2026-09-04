import { useState } from "react";

import CheckmarkIcon from "#/assets/images/checkmark.svg?react";
import CopyIcon from "#/assets/images/copy.svg?react";
import LinkIcon from "#/assets/images/link.svg?react";
import { useCopyToClipboard } from "#/lib/hooks/use-copy-to-clipboard.ts";

import { Button } from "./button.tsx";
import { CopyFailureAlert } from "./copy-failure-alert.tsx";
import { CopyTooltip } from "./copy-tooltip.tsx";

const icons = { copy: CopyIcon, link: LinkIcon };

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
  const [hasFailed, setHasFailed] = useState(false);
  const { state, copy, clearConfirmation } = useCopyToClipboard({ onFailure: () => setHasFailed(true) });
  const isCopied = state === "copied";
  const Icon = icons[variant];

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
          {isCopied ? <CheckmarkIcon /> : <Icon />}
        </Button>
      </CopyTooltip>
      <CopyFailureAlert entity={entity} open={hasFailed} onDismiss={() => setHasFailed(false)} />
    </>
  );
}
