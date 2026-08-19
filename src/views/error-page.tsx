import { useEffect } from "react";

import { Button } from "#/components/button";
import { documentTitle } from "#/config/site";
import { useDismissBootSequence } from "#/lib/boot-sequence/use-dismiss-boot-sequence";

import { DialogBody } from "./dialog-body";
import styles from "./error-page.module.css";

import type { ErrorComponentProps } from "@tanstack/react-router";

export function ErrorPage({ error }: ErrorComponentProps) {
  useDismissBootSequence();

  useEffect(() => {
    if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    const route = location.pathname;
    const report = {
      kind: "router-error-boundary",
      message,
      stack: error instanceof Error ? error.stack : undefined,
      route,
    };

    try {
      const jsonBody = JSON.stringify(report);
      const blob = new Blob([jsonBody], { type: "application/json" });
      const queued = navigator.sendBeacon("/api/client-errors", blob);

      if (!queued) {
        // Fallback to fetch if sendBeacon fails, e.g. due to size limits.
        fetch("/api/client-errors", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: jsonBody,
          keepalive: true,
        }).catch(() => {
          // Ignored.
        });
      }
    } catch {
      // Suppressed.
    }
  }, [error]);

  return (
    <>
      <title>{documentTitle("Error")}</title>
      <main className={styles.errorPage}>
        <DialogBody
          variant="error"
          title="Error"
          headingLevel={1}
          message="There was a problem loading this page."
          actions={
            <>
              <Button children="Try Again" onClick={() => location.reload()} />
              <Button children="Go Home" autoFocus href="/" />
            </>
          }
          className={styles.dialog}
        />
      </main>
    </>
  );
}
