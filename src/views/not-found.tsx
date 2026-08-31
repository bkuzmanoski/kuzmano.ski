import { Alert } from "#/components/alert";
import { NOT_FOUND_PAGE_TITLE } from "#/config/site";
import { useNotFoundRoute, useWindowActions } from "#/lib/window-manager";
import { documentTitle } from "#/metadata";

export function NotFoundAlert() {
  const notFoundRoute = useNotFoundRoute();
  const { dismissNotFound } = useWindowActions();

  return (
    <Alert
      label={NOT_FOUND_PAGE_TITLE}
      message={`This page doesn’t exist. Try finding the page you were looking for in the “Go” menu.`}
      open={notFoundRoute !== null}
      primaryAction={{ label: "OK", onAction: dismissNotFound }}
    />
  );
}

/**
 * The route-level not-found boundary for every route including the root. The window manager
 * reports an unmatched route from the URL, so this supplies only the document title.
 *
 * It renders into the root route's outlet, which sits on the desktop beside the windows, so it
 * must not render anything visible of its own.
 */
export function NotFound() {
  return <title>{documentTitle(NOT_FOUND_PAGE_TITLE)}</title>;
}
