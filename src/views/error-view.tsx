import { Link } from "@tanstack/react-router";

import { documentTitle } from "#/config/site";
import { useClearBootOverlay } from "#/lib/boot-sequence/use-clear-boot-overlay";

import type { ErrorComponentProps } from "@tanstack/react-router";

export function ErrorView({ error, reset }: ErrorComponentProps) {
  useClearBootOverlay();

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
