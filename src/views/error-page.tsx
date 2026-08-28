import { useEffect } from "react";

import { Alert } from "#/components/alert";
import { documentTitle } from "#/config/site";
import { useDismissBootSequence } from "#/lib/boot-sequence/use-dismiss-boot-sequence";

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
        // Fallback to fetch if sendBeacon fails (e.g., due to size limits).
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
      <Alert
        variant="error"
        message="There was a problem loading this page."
        modal={false} // The error boundary replaces the app.
        primaryAction={{ label: "Go Home", onAction: "/" }}
        secondaryAction={{ label: "Reload", onAction: () => location.reload() }}
      />
    </>
  );
}
