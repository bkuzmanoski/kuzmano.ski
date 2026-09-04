// Import only types: importing a value would read from the real content directory.
import type { ScannedContent, ScannedDirectory, ScannedEntry } from "../prerender/routes.ts";

const DATE = "2026-07-19";

export function scannedEntry(slug: string, overrides: Partial<ScannedEntry> = {}): ScannedEntry {
  const date = "date" in overrides ? overrides.date : DATE; // Read by key so an explicit `undefined` is preserved.
  return {
    slug,
    path: `${slug}.mdx`,
    draft: false,
    date,
    frontmatter: { title: slug, description: `About ${slug}.`, date },
    ...overrides,
  };
}

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

export const scannedContent = (overrides: Partial<ScannedContent> = {}): ScannedContent => ({
  pages: scannedDirectory(),
  collections: [],
  ...overrides,
});
