import { Link } from "@tanstack/react-router";

import type { ErrorComponentProps } from "@tanstack/react-router";

export function ErrorFallback({ error, reset }: ErrorComponentProps) {
  return (
    <main>
      <h1>Something went wrong</h1>
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
