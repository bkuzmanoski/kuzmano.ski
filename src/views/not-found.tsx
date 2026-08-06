import { Link } from "@tanstack/react-router";
import { useEffect } from "react";

import { documentTitle } from "#/config/site";
import { clearBootOverlay } from "#/lib/boot";

/**
 * The route-level 404. The window manager opens the 404 window from the URL, the
 * same way it opens every other window, so the route supplies only the document
 * title.
 */
export function NotFound() {
  return <title>{documentTitle("Page not found")}</title>;
}

/** The body of the 404 window. */
export function NotFoundBody() {
  return (
    <article>
      <h1>Page not found (404)</h1>
      <p>This page doesn&rsquo;t exist.</p>
    </article>
  );
}

/**
 * The 404 for a not found that reaches the root, where there is no desktop to open
 * a window in. It stands on its own, the same as the error page.
 */
export function NotFoundPage() {
  useEffect(() => {
    clearBootOverlay();
  }, []);

  return (
    <main>
      <title>{documentTitle("Page not found (404)")}</title>
      <h1>Page not found (404)</h1>
      <p>
        This page doesn&rsquo;t exist. Go to the <Link to="/">home page</Link>.
      </p>
    </main>
  );
}
