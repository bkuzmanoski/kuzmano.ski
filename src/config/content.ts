/**
 * Directory under `src/content/` whose files are pages (`/<slug>`): entries that do  not
 * belong to a collection (`/<collection>/<slug>`).
 */
export const PAGES_DIRECTORY = "_pages";

/**
 * Slugs of the pages the site links to, each backed by `<slug>.mdx` in the pages directory.
 * Page titles and descriptions are read from the page's frontmatter.
 */
export const PAGE_SLUGS = ["about", "experience"] as const;

export type PageSlug = (typeof PAGE_SLUGS)[number];

interface CollectionMetadata {
  title: string;
  description: string;
}

/**
 * Content directories, keyed by URL segment. A collection has no document of its own
 * to carry frontmatter, so the title and description are declared here.
 */
export const COLLECTIONS = {
  work: { title: "Work", description: "Selected projects." },
  "tech-notes": { title: "Tech Notes", description: "Notes on software development." },
  "design-notes": { title: "Design Notes", description: "Notes on interface and visual design." },
} as const satisfies Record<string, CollectionMetadata>;

export type CollectionSegment = keyof typeof COLLECTIONS;
