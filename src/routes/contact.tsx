import { createFileRoute } from "@tanstack/react-router";

import { CONTACT_PAGE_DESCRIPTION, CONTACT_PAGE_ROUTE, CONTACT_PAGE_TITLE } from "#/config/contact";
import { documentHead } from "#/metadata";

/**
 * Declared statically so it outranks `/$segment/`, which resolves pages from MDX frontmatter.
 * The contact window has no document behind it, so this route exists only to supply head tags.
 */
export const Route = createFileRoute("/contact")({
  head: () =>
    documentHead({ title: CONTACT_PAGE_TITLE, description: CONTACT_PAGE_DESCRIPTION, path: CONTACT_PAGE_ROUTE }),
  component: () => null,
});
