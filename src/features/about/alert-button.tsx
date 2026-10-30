import { useState } from "react";
import { createPortal } from "react-dom";

import { Alert } from "#/components/alert.tsx";
import { usePressSound } from "#/lib/audio/use-press-sound.ts";
import { useIsHydrated } from "#/lib/hooks/use-client-value.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";

import styles from "./alert-button.module.css";

import type { ReactNode } from "react";

/** A button around the author's children, such as an image, that opens a modal alert showing `message`. */
export function AlertButton({ message, children }: { message: string; children: ReactNode }) {
  const isHydrated = useIsHydrated();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const pressSoundHandlers = usePressSound({ scrollSafe: true });

  return (
    <>
      <button
        type="button"
        className={styles.alertButton}
        disabled={!isHydrated}
        {...mergeHandlers(pressSoundHandlers, { onClick: () => setIsAlertOpen(true) })}
      >
        {children}
      </button>
      {isHydrated &&
        createPortal(
          <Alert
            message={message}
            open={isAlertOpen}
            primaryAction={{ label: "OK", onAction: () => setIsAlertOpen(false) }}
          />,
          document.body,
        )}
    </>
  );
}
