import type { DateFormat } from "#/lib/hooks/use-date-format";

/**
 * Directory under `src/content/` whose files are pages (`/<slug>`): entries that do  not
 * belong to a collection (`/<collection>/<slug>`).
 */
export const PAGES_DIRECTORY = "_pages";

/**
 * How an entry dates are formatted throughout the site.
 *
 * The users's own locale orders and names the fields. `locale` is the one the
 * prerendered markup is written in, which stands in until the browser's is known.
 */
export const ENTRY_DATE_FORMAT: DateFormat = {
  locale: "en-AU",
  options: { year: "numeric", month: "short", day: "numeric" },
};

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
  work: { title: "Work", description: "" },
  blog: { title: "Blog", description: "" },
} as const satisfies Record<string, CollectionMetadata>;

export type CollectionSegment = keyof typeof COLLECTIONS;
