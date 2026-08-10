import { Link } from "@tanstack/react-router";

import { documentTitle } from "#/config/site";
import { NOT_FOUND_TITLE } from "#/content/window-registry";
import { useClearBootOverlay } from "#/lib/hooks/use-clear-boot-overlay";

/**
 * The route-level 404. The window manager opens the 404 window from the URL, the
 * same way it opens every other window, so the route supplies only the document
 * title.
 */
export function NotFound() {
  return <title>{documentTitle(NOT_FOUND_TITLE)}</title>;
}

/** The body of the 404 window. */
export function NotFoundBody() {
  return (
    <article>
      <h1>{NOT_FOUND_TITLE}</h1>
      <p>This page doesn&rsquo;t exist.</p>
    </article>
  );
}

/**
 * The 404 for a not found that reaches the root, where there is no desktop to open
 * a window in. It stands on its own, the same as the error page.
 */
export function NotFoundPage() {
  useClearBootOverlay();

  return (
    <main>
      <title>{documentTitle(NOT_FOUND_TITLE)}</title>
      <h1>{NOT_FOUND_TITLE}</h1>
      <p>
        This page doesn&rsquo;t exist. Go to the <Link to="/">home page</Link>.
      </p>
    </main>
  );
}
