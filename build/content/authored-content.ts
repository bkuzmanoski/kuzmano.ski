import { readFileSync } from "node:fs";

import { PAGES_DIRECTORY_NAME } from "#/config/content.ts";
import { byNewestDate } from "#/lib/date.ts";
import { isRecord } from "#/lib/guards.ts";

import { frontmatterOf } from "./frontmatter.ts";
import { listedEntriesIn, readContentListing } from "./listing.ts";

import type { ContentDirectoryListing, ContentListing, ListedEntry } from "./listing.ts";

export interface AuthoredEntry extends ListedEntry {
  frontmatter: unknown;
  draft: boolean;
  date: string | undefined;
}

export interface AuthoredContentDirectory {
  entries: Array<AuthoredEntry>;
  subdirectoryNames: Array<string>;
}

export interface AuthoredContent {
  pages: AuthoredContentDirectory;
  collections: Array<AuthoredContentDirectory & { name: string }>;
}

export const publishedEntries = (entries: Array<AuthoredEntry>) => entries.filter(({ draft }) => !draft);
export const byNewestFirst = (a: AuthoredEntry, b: AuthoredEntry) => byNewestDate(a.date, b.date);
export const newestDate = (entries: Array<AuthoredEntry>): string | undefined =>
  entries.reduce<string | undefined>(
    (newest, { date }) => (date && (!newest || date > newest) ? date : newest),
    undefined,
  );

const readAuthoredEntry = (listedEntry: ListedEntry): AuthoredEntry => {
  const frontmatter = frontmatterOf(readFileSync(listedEntry.absolutePath, "utf8"));

  if (!isRecord(frontmatter)) {
    return { ...listedEntry, frontmatter, draft: false, date: undefined };
  }

  return {
    ...listedEntry,
    frontmatter,
    draft: frontmatter.draft === true,
    date: typeof frontmatter.date === "string" ? frontmatter.date : undefined,
  };
};

const readAuthoredContentDirectory = (directoryListing: ContentDirectoryListing): AuthoredContentDirectory => ({
  entries: listedEntriesIn(directoryListing).map(readAuthoredEntry),
  subdirectoryNames: Object.keys(directoryListing.fileNamesBySubdirectoryName),
});

/** Reads the frontmatter of every entry in the content directory. */
export function readAuthoredContent(listing: ContentListing = readContentListing()): AuthoredContent {
  const pages = listing.find(({ directoryName }) => directoryName === PAGES_DIRECTORY_NAME);
  return {
    pages: pages ? readAuthoredContentDirectory(pages) : { entries: [], subdirectoryNames: [] },
    collections: listing
      .filter(({ directoryName }) => directoryName !== PAGES_DIRECTORY_NAME)
      .map((directoryListing) => ({
        name: directoryListing.directoryName,
        ...readAuthoredContentDirectory(directoryListing),
      })),
  };
}
