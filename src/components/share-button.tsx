import { useState } from "react";

import ShareButtonIcon from "#/assets/images/button-icon-share.svg?react";

import { Button } from "./button.tsx";
import { Tooltip } from "./tooltip.tsx";

export function ShareButton({
  url,
  title,
  label = "Share",
  className,
}: {
  url: string;
  title?: string;
  label?: string;
  className?: string;
}) {
  const [isSharing, setIsSharing] = useState(false);

  async function share() {
    if (isSharing) {
      return;
    }

    setIsSharing(true);

    try {
      await navigator.share({ url, title });
    } catch {
      // Ignored.
    }

    setIsSharing(false);
  }

  return (
    <Tooltip label={label} className={className}>
      <Button
        variant="icon"
        holdPressed={isSharing}
        aria-label={label}
        onClick={() => {
          void share();
        }}
      >
        <ShareButtonIcon />
      </Button>
    </Tooltip>
  );
}
