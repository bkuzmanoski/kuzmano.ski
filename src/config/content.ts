import type { DateFormat } from "#/lib/hooks/use-date-format.ts";

export const PAGES_DIRECTORY_NAME = "_pages";

export const ENTRY_DATE_FORMAT: DateFormat = {
  locale: "en-AU",
  options: { year: "numeric", month: "short", day: "numeric" },
};

export const PAGE_SLUGS = ["about", "experience"] as const;

export type PageSlug = (typeof PAGE_SLUGS)[number];

interface CollectionMetadata {
  title: string;
  description: string;
}

export const COLLECTIONS = {
  work: { title: "Work", description: "" },
  blog: { title: "Blog", description: "" },
} as const satisfies Record<string, CollectionMetadata>;

export type CollectionSegment = keyof typeof COLLECTIONS;
