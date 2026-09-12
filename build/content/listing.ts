import { readdirSync } from "node:fs";

import { entryKey, entrySlugOf, isEntryFile } from "#/lib/content/entry-file.ts";
import type { EntryKey } from "#/lib/content/entry-file.ts";

import { fromContent } from "../paths.ts";

// Lists the content directory tree that the authored content and authored media readers take as
// input. Centralizing traversal ensures both readers apply the same inclusion rules.

export const URL_SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface DirectoryItem {
  name: string;
  type: "file" | "directory";
}

export type DirectoryReader = (directoryPathSegments: Array<string>) => Array<DirectoryItem>;

export interface ContentDirectoryListing {
  directoryName: string;
  fileNames: Array<string>;
  fileNamesBySubdirectoryName: Record<string, Array<string>>;
}

export type ContentListing = Array<ContentDirectoryListing>;

export interface ListedEntry {
  slug: string;
  key: EntryKey;
  entryFilePath: string; // Relative to the content directory.
  absolutePath: string;
  mediaDirectoryPath: string; // Relative to the content directory. Derived whether or not the directory exists.
}

const isHiddenDirectoryItem = (name: string) => name.startsWith(".");
const namesIn = (items: Array<DirectoryItem>, type: DirectoryItem["type"]) =>
  items
    .filter((item) => item.type === type && !isHiddenDirectoryItem(item.name))
    .map((item) => item.name)
    .sort(); // Sort filesystem-dependent `readdir` results for deterministic output.

export function contentListingFrom(read: DirectoryReader): ContentListing {
  const directoryOf = (directoryName: string): ContentDirectoryListing => {
    const directoryItems = read([directoryName]);
    const fileNamesBySubdirectoryName: Record<string, Array<string>> = {};

    for (const subdirectoryName of namesIn(directoryItems, "directory")) {
      fileNamesBySubdirectoryName[subdirectoryName] = namesIn(read([directoryName, subdirectoryName]), "file");
    }

    return { directoryName, fileNames: namesIn(directoryItems, "file"), fileNamesBySubdirectoryName };
  };

  return namesIn(read([]), "directory").map(directoryOf);
}

/** Returns entries in a directory, in listing order, without reading frontmatter. */
export const listedEntriesIn = ({ directoryName, fileNames }: ContentDirectoryListing): Array<ListedEntry> =>
  fileNames.filter(isEntryFile).map((fileName) => {
    const slug = entrySlugOf(fileName);
    return {
      slug,
      key: entryKey(directoryName, slug),
      entryFilePath: `${directoryName}/${fileName}`,
      absolutePath: fromContent(directoryName, fileName),
      mediaDirectoryPath: `${directoryName}/${slug}`,
    };
  });

const readDirectory: DirectoryReader = (directoryPathSegments) =>
  readdirSync(fromContent(...directoryPathSegments), { withFileTypes: true }).flatMap(
    (dirent): Array<DirectoryItem> => {
      if (dirent.isFile()) {
        return [{ name: dirent.name, type: "file" }];
      }

      if (dirent.isDirectory()) {
        return [{ name: dirent.name, type: "directory" }];
      }

      return []; // Drops symbolic links and other special files, since content is only regular files and directories.
    },
  );

/**
 * Reads the content directory two levels deep.
 *
 * The result is not cached so development changes are picked up without a restart.
 */
export const readContentListing = (): ContentListing => contentListingFrom(readDirectory);
