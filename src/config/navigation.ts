import type { IconKind } from "#/lib/icons/icon";

export interface Destination {
  title: string;
  iconKind: Extract<IconKind, "page" | "collection">;
  route: string;
}

const collection = (segment: string, title: string): Destination => ({
  title: title,
  iconKind: "collection",
  route: `/${segment}`,
});

const page = (slug: string, title: string): Destination => ({ title, iconKind: "page", route: `/${slug}` });

export const DESTINATIONS = {
  about: page("about", "About"),
  experience: page("experience", "Experience"),
  work: collection("work", "Work"),
  "tech-notes": collection("tech-notes", "Tech Notes"),
  "design-notes": collection("design-notes", "Design Notes"),
  contact: page("contact", "Contact"),
} as const satisfies Record<string, Destination>;

export type DestinationId = keyof typeof DESTINATIONS;

/**
 * Destinations in display order, split into groups. Menus draw a separator
 * between groups; consumers that render a flat list use `DESTINATION_ORDER`.
 */
export const DESTINATION_GROUPS = [
  ["about", "experience", "work"],
  ["tech-notes", "design-notes"],
  ["contact"],
] as const satisfies ReadonlyArray<ReadonlyArray<DestinationId>>;

export const DESTINATION_ORDER: ReadonlyArray<DestinationId> = DESTINATION_GROUPS.flat();

/** A mapping of URL segment -> title, for folder destinations only. */
export const COLLECTION_TITLES: Record<string, string> = Object.fromEntries(
  Object.values(DESTINATIONS)
    .filter((destination) => destination.iconKind === "collection")
    .map((destination) => [destination.route.slice(1), destination.title]),
);

export const INITIAL_WINDOW_ROUTE = DESTINATIONS.about.route;
