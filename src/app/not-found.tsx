import { NOT_FOUND_DOCUMENT_TITLE } from "#/config/site.ts";
import { documentTitle } from "#/site/metadata.ts";

/**
 * The not-found boundary, registered for every route and for the root. The window manager shows the
 * not-found alert for a route it cannot resolve, so this renders only the document title.
 */
export function NotFound() {
  return <title>{documentTitle(NOT_FOUND_DOCUMENT_TITLE)}</title>;
}
