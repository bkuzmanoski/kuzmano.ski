// Import only types: importing a value would read from the real content directory.
import type { ScannedContent, ScannedDirectory, ScannedEntry } from "../../build/prerender/routes.ts";

const DATE = "2026-07-19";

/**
 * An entry as `scanContent` reports it, published and dated, with frontmatter naming its slug.
 *
 * `overrides` replaces any field, so a suite states the one condition it exercises rather than
 * restating a valid entry around it. Passing `date: undefined` describes an undated entry.
 */
export function scannedEntry(slug: string, overrides: Partial<ScannedEntry> = {}): ScannedEntry {
  const date = "date" in overrides ? overrides.date : DATE; // Read by key so an explicit `undefined` is honoured rather than replaced by the default.
  return {
    slug,
    path: `${slug}.mdx`,
    draft: false,
    date,
    frontmatter: { title: slug, description: `About ${slug}.`, date },
    ...overrides,
  };
}

/** An entry the build leaves unpublished. */
export const draftEntry = (slug: string, overrides: Partial<ScannedEntry> = {}): ScannedEntry =>
  scannedEntry(slug, { ...overrides, draft: true });

export const scannedDirectory = (
  entries: Array<ScannedEntry> = [],
  subdirectories: Array<string> = [],
): ScannedDirectory => ({ entries, subdirectories });
export const scannedCollection = (
  name: string,
  entries: Array<ScannedEntry> = [],
  subdirectories: Array<string> = [],
) => ({ name, ...scannedDirectory(entries, subdirectories) }) satisfies ScannedContent["collections"][number];

/** An empty content tree. A suite supplies the collections and pages its subject reads. */
export const scannedContent = (overrides: Partial<ScannedContent> = {}): ScannedContent => ({
  collections: [],
  pages: scannedDirectory(),
  ...overrides,
});
