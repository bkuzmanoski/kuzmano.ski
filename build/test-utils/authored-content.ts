// Import only types from `/build/content`: importing a value would read from the real content directory.
import { listedEntry } from "./listing.ts";

import type { AuthoredContent, AuthoredContentDirectory, AuthoredEntry } from "../content/authored-content.ts";
import type { ListedEntry } from "../content/listing.ts";

const ENTRY_DATE = "2026-07-19";

type UnplacedAuthoredEntry = Omit<AuthoredEntry, Exclude<keyof ListedEntry, "slug">>;
type AuthoredEntryOverrides = Partial<Omit<AuthoredEntry, keyof ListedEntry>>;

export function authoredEntry(slug: string, overrides: AuthoredEntryOverrides = {}): UnplacedAuthoredEntry {
  const date = "date" in overrides ? overrides.date : ENTRY_DATE; // Read by key so an explicit `undefined` is preserved.
  return {
    slug,
    frontmatter: { title: slug, description: `About ${slug}.`, date },
    draft: false,
    date,
    ...overrides,
  };
}

export const draftEntry = (slug: string, overrides: AuthoredEntryOverrides = {}): UnplacedAuthoredEntry =>
  authoredEntry(slug, { ...overrides, draft: true });

const authoredEntryIn = (
  directoryName: string,
  { slug, frontmatter, draft, date }: UnplacedAuthoredEntry, // Only the authored fields are taken from `entry`, so an entry reused from another directory is given this directory's key and paths.
): AuthoredEntry => ({ ...listedEntry(directoryName, slug), frontmatter, draft, date });

/** Returns the content directory named `directoryName`, with each entry placed in it. */
export const authoredContentDirectory = (
  directoryName: string,
  entries: Array<UnplacedAuthoredEntry> = [],
  subdirectoryNames: Array<string> = [],
): AuthoredContentDirectory => ({
  entries: entries.map((entry) => authoredEntryIn(directoryName, entry)),
  subdirectoryNames,
});
export const authoredCollection = (
  name: string,
  entries: Array<UnplacedAuthoredEntry> = [],
  subdirectoryNames: Array<string> = [],
) =>
  ({
    name,
    ...authoredContentDirectory(name, entries, subdirectoryNames),
  }) satisfies AuthoredContent["collections"][number];
export const authoredContent = (overrides: Partial<AuthoredContent> = {}): AuthoredContent => ({
  pages: { entries: [], subdirectoryNames: [] },
  collections: [],
  ...overrides,
});
