import { useEffect } from "react";

import { Alert } from "#/components/alert.tsx";
import { useDismissBootSequence } from "#/lib/boot-sequence/use-dismiss-boot-sequence.ts";
import { reportClientError } from "#/lib/client-errors/client.ts";
import { documentTitle } from "#/site/metadata.ts";

import type { ErrorComponentProps } from "@tanstack/react-router";

export function ErrorPage({ error }: ErrorComponentProps) {
  useDismissBootSequence();

  useEffect(() => {
    if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
      return;
    }

    reportClientError({
      kind: "router-error-boundary",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      route: location.pathname,
    });
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
