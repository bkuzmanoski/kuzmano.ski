import { Button } from "#/components/button";
import { ButtonGroup } from "#/components/button-group";
import { documentTitle } from "#/config/site";
import { useClearBootOverlay } from "#/lib/boot-sequence/use-clear-boot-overlay";

import styles from "./error-page.module.css";

import type { ErrorComponentProps } from "@tanstack/react-router";

export function ErrorPage({ error: _error }: ErrorComponentProps) {
  useClearBootOverlay();

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
            <Button children="Go Home" onClick={() => (location.href = "/")} />
            <Button children="Try Again" autoFocus onClick={() => location.reload()} />
          </ButtonGroup>
        </div>
      </main>
    </>
  );
}
