import { relative, sep } from "node:path";

import type { EntryBodyChunks } from "#/lib/content/catalog.ts";
import { entryKey, entrySlugOf, isEntryFile, stylesheetFilePathOf } from "#/lib/content/entry-file.ts";
import type { EntryKey } from "#/lib/content/entry-file.ts";

import { CLIENT_ENVIRONMENT, SERVER_ENVIRONMENT } from "../environments.ts";
import { jsonValueModulePlugin } from "../json-value-module.ts";
import { fromContent } from "../paths.ts";

import { listedEntriesIn, readContentListing } from "./listing.ts";

import type { ContentListing } from "./listing.ts";
import type { Plugin, Rollup } from "vite";

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

/** The fields of a client chunk `entryBodyChunksIn` reads. */
export type BundledChunk = Pick<Rollup.OutputChunk, "fileName" | "facadeModuleId" | "isEntry" | "imports"> & {
  viteMetadata?: { importedCss: Set<string> };
};

/**
 * Returns the chunks and stylesheets each entry loads, keyed by entry key: its body chunk, the chunk of
 * the stylesheet beside it, and the chunks those import statically, with the stylesheets of all of them.
 *
 * The chunk of the hydration entry, `/src/client.tsx`, and the chunks it imports statically are left out,
 * along with their stylesheets, since every document already loads them. A component an entry imports is
 * bundled into the entry's body chunk or a chunk the body chunk imports.
 */
export function entryBodyChunksIn(chunks: Array<BundledChunk>, base: string): Record<EntryKey, EntryBodyChunks> {
  const chunksByFileName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const chunksByFacadeModuleId = new Map(chunks.map((chunk) => [chunk.facadeModuleId, chunk]));

  function staticImportClosureOf(fileNames: Array<string>): Array<string> {
    const closure = new Set<string>();
    const visit = (fileName: string) => {
      if (closure.has(fileName)) {
        return;
      }

      closure.add(fileName);
      chunksByFileName.get(fileName)?.imports.forEach(visit);
    };

    fileNames.forEach(visit);

    return [...closure];
  }

  const fileNamesEveryDocumentLoads = new Set(
    staticImportClosureOf(chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName)),
  );
  const entryBodyChunks: Record<EntryKey, EntryBodyChunks> = {};

  for (const chunk of chunks) {
    const chunkEntryKey = entryKeyOf(chunk.facadeModuleId);

    if (!chunkEntryKey || !chunk.facadeModuleId) {
      continue;
    }

    const stylesheetChunk = chunksByFacadeModuleId.get(stylesheetFilePathOf(chunk.facadeModuleId));
    const fileNames = staticImportClosureOf(
      stylesheetChunk ? [chunk.fileName, stylesheetChunk.fileName] : [chunk.fileName],
    ).filter((fileName) => !fileNamesEveryDocumentLoads.has(fileName));
    const stylesheetFileNames = new Set(
      fileNames.flatMap((fileName) => [...(chunksByFileName.get(fileName)?.viteMetadata?.importedCss ?? [])]),
    );

    entryBodyChunks[chunkEntryKey] = {
      moduleUrls: fileNames.map((fileName) => `${base}${fileName}`),
      stylesheetUrls: [...stylesheetFileNames].map((fileName) => `${base}${fileName}`),
    };
  }

  return entryBodyChunks;
}

/**
 * Captures the chunks and stylesheets each entry loads in the client build and exposes them through
 * `virtual:entry-body-chunks`.
 *
 * Server builds link them from the document, so an entry's code is preloaded and its stylesheets
 * apply before hydration; client and development builds receive an empty map.
 */
export function entryBodyChunksPlugin(): Array<Plugin> {
  let entryBodyChunks: Record<EntryKey, EntryBodyChunks> = {};
  return [
    {
      name: "kuzmano.ski:entry-body-chunks-capture",
      applyToEnvironment: (environment) => environment.name === CLIENT_ENVIRONMENT,
      enforce: "post",
      generateBundle(_options, bundle) {
        entryBodyChunks = entryBodyChunksIn(
          Object.values(bundle).filter((output) => output.type === "chunk"),
          this.environment.config.base,
        );

        const drift = entryChunkDriftBetween(Object.keys(entryBodyChunks), entryKeysIn(readContentListing()));

        if (drift.length > 0) {
          this.error(`Entry chunk drift: ${drift.join("; ")}.`);
        }
      },
    },
    jsonValueModulePlugin({
      name: "kuzmano.ski:entry-body-chunks",
      moduleId: "virtual:entry-body-chunks",
      exportName: "ENTRY_BODY_CHUNKS",
      load: ({ name, config }) => (name === SERVER_ENVIRONMENT && config.command === "build" ? entryBodyChunks : {}),
    }),
  ];
}
