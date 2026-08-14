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
    const report = {
      kind: "router-error-boundary",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      route: location.pathname,
    };
    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report),
      keepalive: true,
    });
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
