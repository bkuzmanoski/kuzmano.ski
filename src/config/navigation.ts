import type { IconKind } from "#/lib/icon";

export interface Destination {
  title: string;
  iconKind: Extract<IconKind, "app" | "folder">;
  route: string;
}

const collection = (segment: string, title: string): Destination => ({
  title: title,
  iconKind: "folder",
  route: `/${segment}`,
});

const page = (slug: string, title: string): Destination => ({ title, iconKind: "app", route: `/${slug}` });

export const DESTINATIONS = {
  about: page("about", "About"),
  experience: page("experience", "Experience"),
  "tech-notes": collection("tech-notes", "Tech Notes"),
  "design-notes": collection("design-notes", "Design Notes"),
  work: collection("work", "Work"),
  contact: page("contact", "Contact"),
} as const satisfies Record<string, Destination>;

export type DestinationId = keyof typeof DESTINATIONS;

/** A mapping of URL segment -> title, for folder destinations only. */
export const COLLECTION_TITLES: Record<string, string> = Object.fromEntries(
  Object.values(DESTINATIONS)
    .filter((destination) => destination.iconKind === "folder")
    .map((destination) => [destination.route.slice(1), destination.title]),
);

export const DESTINATION_ORDER = [
  "about",
  "experience",
  "tech-notes",
  "design-notes",
  "work",
  "contact",
] as const satisfies ReadonlyArray<DestinationId>;

export const INITIAL_WINDOW_ROUTE = DESTINATIONS.about.route;
