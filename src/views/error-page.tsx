import { useEffect } from "react";

import { Button } from "#/components/button";
import { ButtonGroup } from "#/components/button-group";
import { documentTitle } from "#/config/site";
import { useClearBootOverlay } from "#/lib/boot-sequence/use-clear-boot-overlay";

import styles from "./error-page.module.css";

import type { ErrorComponentProps } from "@tanstack/react-router";

export function ErrorPage({ error }: ErrorComponentProps) {
  useClearBootOverlay();

  useEffect(() => {
    if (import.meta.env.DEV || import.meta.env.MODE === "test") {
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
      const queued = typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/client-errors", blob);

      if (!queued) {
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
        <div className={styles.dialog}>
          <div className={styles.message}>
            <h1 className={styles.title}>Error</h1>
            <p>There was a problem loading this page.</p>
          </div>
          <ButtonGroup>
            <Button children="Try Again" onClick={() => location.reload()} />
            <Button children="Go Home" autoFocus onClick={() => (location.href = "/")} />
          </ButtonGroup>
        </div>
      </main>
    </>
  );
}
