import { useState } from "react";

import ShareButtonIcon from "#/assets/images/button-icon-share.svg?react";

import { ActionFailureAlert } from "./action-failure-alert.tsx";
import { IconButton } from "./icon-button.tsx";

export function ShareButton({
  url,
  title,
  label = "Share",
  disabled = false,
  className,
}: {
  url: string;
  title?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareFailure, setShareFailure] = useState<{ isPermissionDenied: boolean } | null>(null);

  async function share() {
    if (isSharing) {
      return;
    }

    setIsSharing(true);

    try {
      await navigator.share({ url, title });
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : null;
      setShareFailure(errorName === "AbortError" ? null : { isPermissionDenied: errorName === "NotAllowedError" });
    }

    setIsSharing(false);
  }

  return (
    <>
      <IconButton
        variant="standalone"
        label={label}
        disabled={disabled}
        holdPressed={isSharing}
        className={className}
        onClick={() => {
          void share();
        }}
      >
        <ShareButtonIcon />
      </IconButton>
      <ActionFailureAlert
        action="share"
        entity="link"
        isPermissionDenied={shareFailure?.isPermissionDenied ?? false}
        open={shareFailure !== null}
        onDismiss={() => setShareFailure(null)}
      />
    </>
  );
}
