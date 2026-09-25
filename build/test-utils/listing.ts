// This module imports only types from `/build/content`. Importing a value would read from the real content directory.
import { fromContent } from "../paths.ts";

import type { ListedEntry } from "../content/listing.ts";

/** Creates an entry identity using the same layout as `listedEntriesIn`. */
export const listedEntry = (directoryName: string, slug: string): ListedEntry => ({
  slug,
  key: `${directoryName}/${slug}` as ListedEntry["key"],
  entryFilePath: `${directoryName}/${slug}.mdx`,
  absolutePath: fromContent(directoryName, `${slug}.mdx`),
  mediaDirectoryPath: `${directoryName}/${slug}`,
});
