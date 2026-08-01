/** Directory of MDX files served as top-level routes (`/<slug>`). */
export const PAGES_DIRECTORY = "_pages";

/** A mapping of URL segment -> display title. */
export const COLLECTION_TITLES = {
  "tech-notes": "Tech Notes",
  "design-notes": "Design Notes",
  work: "Work",
} as const satisfies Record<string, string>;
