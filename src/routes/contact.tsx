import { createFileRoute } from "@tanstack/react-router";

import { CONTACT_DOCUMENT_DESCRIPTION, CONTACT_DOCUMENT_TITLE, CONTACT_ROUTE } from "#/config/contact.ts";
import { documentHead } from "#/site/metadata.ts";

/**
 * Declared statically so it outranks `/$segment/`, which resolves a segment to a collection or a page.
 * The contact window has no document behind it, so this route exists only to supply head tags.
 */
export const Route = createFileRoute("/contact")({
  head: () =>
    documentHead({ title: CONTACT_DOCUMENT_TITLE, description: CONTACT_DOCUMENT_DESCRIPTION, path: CONTACT_ROUTE }),
  component: () => null,
});
