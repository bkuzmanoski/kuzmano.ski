import { CONTACT_PAGE_ROUTE, CONTACT_PAGE_TITLE } from "#/config/contact";
import { COLLECTIONS } from "#/config/content";
import type { CollectionSegment, PageSlug } from "#/config/content";
import type { Destination } from "#/lib/window-manager";

import { pages } from "./index";

const titleOf = (slug: PageSlug) => {
  try {
    return pages.frontmatterOf(slug)?.title ?? slug;
  } catch {
    return slug; // Throwing here would tear down the desktop before the error boundary exists; use the slug as a fallback.
  }
};
const entry = (slug: PageSlug): Destination => ({ type: "entry", title: titleOf(slug), route: `/${slug}` });
const collection = (segment: CollectionSegment): Destination => ({
  type: "collection",
  title: COLLECTIONS[segment].title,
  route: `/${segment}`,
});

export const DESTINATIONS = {
  about: entry("about"),
  experience: entry("experience"),
  work: collection("work"),
  blog: collection("blog"),
  contact: {
    type: "contact",
    title: CONTACT_PAGE_TITLE,
    route: CONTACT_PAGE_ROUTE,
  },
} as const satisfies Record<string, Destination>;

export type DestinationId = keyof typeof DESTINATIONS;

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

export const INITIAL_WINDOW_ROUTE = DESTINATIONS.about.route;
