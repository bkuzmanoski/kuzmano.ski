import { COLLECTION_TITLES } from "#/content/configuration";
import type { IconKind } from "#/lib/icon";

export interface Destination {
  label: string;
  iconKind: Extract<IconKind, "app" | "folder">;
  route: string;
}

const collection = (segment: keyof typeof COLLECTION_TITLES): Destination => ({
  label: COLLECTION_TITLES[segment],
  iconKind: "folder",
  route: `/${segment}`,
});

const page = (slug: string, label: string): Destination => ({ label, iconKind: "app", route: `/${slug}` });

export const DESTINATIONS = {
  about: page("about", "About"),
  "tech-notes": collection("tech-notes"),
  "design-notes": collection("design-notes"),
  work: collection("work"),
  contact: page("contact", "Contact"),
} as const satisfies Record<string, Destination>;

export type DestinationId = keyof typeof DESTINATIONS;

export const DESTINATION_ORDER = [
  "about",
  "tech-notes",
  "design-notes",
  "work",
  "contact",
] as const satisfies ReadonlyArray<DestinationId>;

export const INITIAL_WINDOW_ROUTE = DESTINATIONS.about.route;
