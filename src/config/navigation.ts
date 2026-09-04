import { CONTACT_DOCUMENT_TITLE, CONTACT_ROUTE } from "./contact.ts";
import { COLLECTIONS } from "./content.ts";

import type { CollectionSegment, PageSlug } from "./content.ts";

export type DestinationId = PageSlug | CollectionSegment | "contact";

export type DestinationSpec =
  | { type: "entry"; route: `/${PageSlug}` }
  | { type: "collection"; route: `/${CollectionSegment}`; title: string }
  | { type: "contact"; route: string; title: string };

export const DESTINATION_SPECS = {
  about: { type: "entry", route: "/about" },
  experience: { type: "entry", route: "/experience" },
  work: { type: "collection", route: "/work", title: COLLECTIONS.work.title },
  blog: { type: "collection", route: "/blog", title: COLLECTIONS.blog.title },
  contact: { type: "contact", route: CONTACT_ROUTE, title: CONTACT_DOCUMENT_TITLE },
} as const satisfies Record<DestinationId, DestinationSpec>;

/**
 * Destinations in display order, split into groups. Menus render a separator
 * between groups; consumers that render a flat list use `DESTINATION_ORDER`.
 */
export const DESTINATION_GROUPS = [
  ["about", "experience", "work"],
  ["blog"],
  ["contact"],
] as const satisfies ReadonlyArray<ReadonlyArray<DestinationId>>;

export const DESTINATION_ORDER: ReadonlyArray<DestinationId> = DESTINATION_GROUPS.flat();

export const INITIAL_WINDOW_ROUTE: string = DESTINATION_SPECS.about.route;
