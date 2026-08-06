import { Link } from "@tanstack/react-router";
import { useEffect } from "react";

import { documentTitle } from "#/config/site";
import { clearBootOverlay } from "#/lib/boot";

import type { ErrorComponentProps } from "@tanstack/react-router";

export function ErrorView({ error, reset }: ErrorComponentProps) {
  useEffect(() => {
    clearBootOverlay();
  }, []);

  return (
    <main>
      <title>{documentTitle("Error")}</title>
      <h1>Error</h1>
      {import.meta.env.DEV && <pre>{error.stack ?? error.message}</pre>}
      <p>
        <button type="button" onClick={reset}>
          Try again
        </button>{" "}
        or <Link to="/">go back home</Link>.
      </p>
    </main>
  );
}
