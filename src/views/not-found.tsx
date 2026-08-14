import { documentTitle } from "#/config/site";
import { NOT_FOUND_TITLE } from "#/content/window-registry";

/** The body of the not-found window. */
export function NotFoundBody() {
  return (
    <article>
      <h1>{NOT_FOUND_TITLE}</h1>
      <p>This page doesn&rsquo;t exist.</p>
    </article>
  );
}

/**
 * The route-level not-found boundary for every route including the root. The
 * window manager opens a not-found window from the URL so this supplies only
 * the document title.
 *
 * It renders into the root route's outlet, which sits on the desktop beside
 * the windows, so it must not render anything visible of its own.
 */
export function NotFoundPage() {
  return <title>{documentTitle(NOT_FOUND_TITLE)}</title>;
}
