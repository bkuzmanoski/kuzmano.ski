import { NOT_FOUND_DOCUMENT_TITLE } from "#/config/site.ts";
import { documentTitle } from "#/site/metadata.ts";

/** Not-found route boundary. Renders only the document title, as the window manager displays the not-found alert. */
export function NotFound() {
  return <title>{documentTitle(NOT_FOUND_DOCUMENT_TITLE)}</title>;
}
