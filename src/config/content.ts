import type { DateFormat } from "#/lib/datetime.ts";

import { SITE_LOCALE } from "./site.ts";

export const PAGES_DIRECTORY_NAME = "_pages";

export const ENTRY_DATE_FORMAT: DateFormat = {
  locale: SITE_LOCALE,
  options: { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" },
};
export const EXPERIENCE_MONTH_FORMAT: DateFormat = {
  locale: SITE_LOCALE,
  options: { year: "numeric", month: "short", timeZone: "UTC" },
};

export const PAGE_SLUGS = ["about", "experience"] as const;

export type PageSlug = (typeof PAGE_SLUGS)[number];

interface CollectionMetadata {
  title: string;
  description: string;
}

export const COLLECTIONS = {
  work: {
    title: "Work",
    description:
      "Product design, software development, technology consulting, and teaching projects for clients including Loopit, Kinesis, Ansarada, SAP, and Transport for NSW.",
  },
  notes: {
    title: "Notes",
    description: "Writing on UI design and software development for macOS, iOS, and the web.",
  },
} as const satisfies Record<string, CollectionMetadata>;

export type CollectionSegment = keyof typeof COLLECTIONS;
