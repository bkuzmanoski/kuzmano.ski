import { COLLECTIONS } from "#/config/content";
import type { CollectionSegment, PageSlug } from "#/config/content";
import { pages } from "#/content";

/** A navigation target: one entry, or a collection of them. */
export interface Destination {
  type: "entry" | "collection";
  title: string;
  route: string;
}

const titleOf = (slug: PageSlug) => {
  try {
    return pages.frontmatterOf(slug)?.title ?? slug;
  } catch {
    // Throwing here would tear down the desktop before the error boundary exists; use the slug as a fallback.
    return slug;
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
  "tech-notes": collection("tech-notes"),
  "design-notes": collection("design-notes"),
  contact: entry("contact"),
} as const satisfies Record<string, Destination>;

export type DestinationId = keyof typeof DESTINATIONS;

/**
 * Destinations in display order, split into groups. Menus render a separator
 * between groups; consumers that render a flat list use `DESTINATION_ORDER`.
 */
export const DESTINATION_GROUPS = [
  ["about", "experience", "work"],
  ["tech-notes", "design-notes"],
  ["contact"],
] as const satisfies ReadonlyArray<ReadonlyArray<DestinationId>>;

export const DESTINATION_ORDER: ReadonlyArray<DestinationId> = DESTINATION_GROUPS.flat();

export const INITIAL_WINDOW_ROUTE = DESTINATIONS.about.route;
