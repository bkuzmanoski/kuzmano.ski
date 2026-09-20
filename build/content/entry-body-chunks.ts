import { relative, sep } from "node:path";

import { entryKey, entrySlugOf, isEntryFile } from "#/lib/content/entry-file.ts";
import type { EntryKey } from "#/lib/content/entry-file.ts";

import { CLIENT_ENVIRONMENT, SERVER_ENVIRONMENT } from "../environments.ts";
import { fromContent } from "../paths.ts";

import { listedEntriesIn, readContentListing } from "./listing.ts";

import type { ContentListing } from "./listing.ts";
import type { Plugin } from "vite";

const MODULE_ID = "virtual:entry-body-chunks";
const RESOLVED_MODULE_ID = `\0${MODULE_ID}`;

const MAX_LISTED_ENTRY_KEYS = 3;

const contentDirectoryAbsolutePath = fromContent();

export function entryKeyOf(moduleId: string | null | undefined): EntryKey | null {
  if (!moduleId || !isEntryFile(moduleId)) {
    return null;
  }

  const [directoryName, fileName, ...rest] = relative(contentDirectoryAbsolutePath, moduleId).split(sep);

  if (directoryName === undefined || directoryName === ".." || fileName === undefined || rest.length > 0) {
    return null;
  }

  return entryKey(directoryName, entrySlugOf(fileName));
}

/** The entry key of every `.mdx` file in the content tree, in listing order. */
export const entryKeysIn = (listing: ContentListing): Array<EntryKey> =>
  listing.flatMap((directoryListing) => listedEntriesIn(directoryListing).map(({ key }) => key));

const formatListedKeys = (keys: Array<string>) =>
  keys.length > MAX_LISTED_ENTRY_KEYS
    ? `${keys.slice(0, MAX_LISTED_ENTRY_KEYS).join(", ")} and ${keys.length - MAX_LISTED_ENTRY_KEYS} more`
    : keys.join(", ");

/** Returns every difference between the entries the client build produced a chunk for and the entries on disk. */
export function entryChunkDriftBetween(
  producedChunkKeys: Array<string>,
  onDiskEntryKeys: Array<string>,
): Array<string> {
  const entryKeysWithAChunk = new Set(producedChunkKeys);
  const entryKeysOnDisk = new Set(onDiskEntryKeys);
  const missingChunks = onDiskEntryKeys.filter((key) => !entryKeysWithAChunk.has(key));
  const unexpectedChunks = producedChunkKeys.filter((key) => !entryKeysOnDisk.has(key));

  return [
    ...(missingChunks.length > 0 ? [`no chunk was produced for ${formatListedKeys(missingChunks)}`] : []),
    ...(unexpectedChunks.length > 0
      ? [`a chunk was produced for ${formatListedKeys(unexpectedChunks)}, which is not an entry`]
      : []),
  ];
}

/**
 * Captures client entry body chunk URLs and exposes them through `virtual:entry-body-chunks`.
 *
 * Server builds use the URLs to preload body chunks before hydration; client and development
 * builds receive an empty map.
 */
export function entryBodyChunksPlugin(): Array<Plugin> {
  let entryBodyChunkUrls: Record<EntryKey, string> = {};
  return [
    {
      name: "kuzmano.ski:entry-body-chunks-capture",
      applyToEnvironment: (environment) => environment.name === CLIENT_ENVIRONMENT,
      enforce: "post",
      generateBundle(_options, bundle) {
        const { base } = this.environment.config;

        entryBodyChunkUrls = {};

        for (const [fileName, output] of Object.entries(bundle)) {
          if (output.type !== "chunk") {
            continue;
          }

          const chunkEntryKey = entryKeyOf(output.facadeModuleId);

          if (chunkEntryKey) {
            entryBodyChunkUrls[chunkEntryKey] = `${base}${fileName}`;
          }
        }

        const drift = entryChunkDriftBetween(Object.keys(entryBodyChunkUrls), entryKeysIn(readContentListing()));

        if (drift.length > 0) {
          this.error(`Entry chunk drift: ${drift.join("; ")}.`);
        }
      },
    },
    {
      name: "kuzmano.ski:entry-body-chunks",
      enforce: "pre",
      resolveId: (source) => (source === MODULE_ID ? RESOLVED_MODULE_ID : null),
      load(id) {
        if (id !== RESOLVED_MODULE_ID) {
          return null;
        }

        const isServerBuild =
          this.environment.name === SERVER_ENVIRONMENT && this.environment.config.command === "build";

        return `export const ENTRY_BODY_CHUNKS = ${JSON.stringify(isServerBuild ? entryBodyChunkUrls : {})};`;
      },
    },
  ];
}
