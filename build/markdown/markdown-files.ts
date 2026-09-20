import { readFile } from "node:fs/promises";

import { COLLECTIONS } from "#/config/content.ts";
import { parseFrontmatter } from "#/lib/content/frontmatter.ts";
import { markdownPath } from "#/lib/content/paths.ts";
import { canonicalUrl } from "#/site/metadata.ts";
import { collectionRoute, entryRoute, pageRoute } from "#/site/routes.ts";

import { byNewestFirst, publishedEntries } from "../content/authored-content.ts";
import { NO_MEDIA_FOR_ENTRY } from "../content/markup/media-rewrite.ts";

import { markdownFor } from "./markdown.ts";

import type { AuthoredContent, AuthoredEntry } from "../content/authored-content.ts";
import type { MediaForEntry } from "../content/markup/media-rewrite.ts";

interface MarkdownFile {
  path: string;
  render: () => Promise<string>;
}

async function entryMarkdown(entry: AuthoredEntry, route: string, mediaForEntry: MediaForEntry): Promise<string> {
  // Validate the frontmatter even though it is emitted unchanged. A malformed block should
  // fail the build rather than be included in the Markdown file.
  parseFrontmatter(entry.frontmatter, entry.entryFilePath);
  return markdownFor(await readFile(entry.absolutePath, "utf8"), {
    path: entry.absolutePath,
    url: canonicalUrl(route),
    mediaForEntry,
  });
}

const asLinkText = (value: string) => value.replace(/[\\[\]]/g, (character) => `\\${character}`); // Escapes the characters that would otherwise end a link's text or its destination early.
const asOneLine = (value: string) => value.replace(/\s+/g, " ").trim(); // Collapses a description onto the single line its list item occupies.

// A collection's entries as a Markdown index, linking each entry's Markdown. A collection
// has no document of its own, so the index is its Markdown representation.
function collectionMarkdown(name: string, entries: Array<AuthoredEntry>): string {
  // Widened because `name` may be a directory that is not a declared collection.
  const declaredCollections: Record<string, { title: string; description: string } | undefined> = COLLECTIONS;
  const collectionMetadata = declaredCollections[name];

  if (!collectionMetadata) {
    throw new Error(`Collection "${name}" is missing a title for its Markdown index.`);
  }

  const entryListItems = [...entries].sort(byNewestFirst).map((entry) => {
    const { title, description, date } = parseFrontmatter(entry.frontmatter, entry.entryFilePath);
    return `- [${asLinkText(title)}](${markdownPath(entryRoute(name, entry.slug))}) (${date})\n  ${asOneLine(description)}`;
  });
  const markdownSections = [
    `# ${collectionMetadata.title}`,
    ...(collectionMetadata.description ? [collectionMetadata.description] : []),
    ...(entryListItems.length > 0 ? [entryListItems.join("\n")] : []),
  ];

  return `${markdownSections.join("\n\n")}\n`;
}

/** Returns Markdown files for entries and collection indexes, each rendered on demand. */
export function markdownFilesFor(
  { pages, collections }: AuthoredContent,
  {
    includeDrafts = false,
    mediaForEntry = NO_MEDIA_FOR_ENTRY,
  }: { includeDrafts?: boolean; mediaForEntry?: MediaForEntry } = {},
): Array<MarkdownFile> {
  const includedEntries = (entries: Array<AuthoredEntry>) => (includeDrafts ? entries : publishedEntries(entries));
  return [
    ...includedEntries(pages.entries).map((entry) => ({
      path: markdownPath(pageRoute(entry.slug)),
      render: () => entryMarkdown(entry, pageRoute(entry.slug), mediaForEntry),
    })),
    ...collections.flatMap(({ name, entries }) => {
      const entriesToRender = includedEntries(entries);
      return [
        ...entriesToRender.map((entry) => ({
          path: markdownPath(entryRoute(name, entry.slug)),
          render: () => entryMarkdown(entry, entryRoute(name, entry.slug), mediaForEntry),
        })),
        {
          path: markdownPath(collectionRoute(name)),
          // eslint-disable-next-line @typescript-eslint/require-await -- Asynchronous so an invalid entry rejects the render rather than throwing at the caller.
          render: async () => collectionMarkdown(name, entriesToRender),
        },
      ];
    }),
  ];
}

/** Renders each Markdown file once and returns its contents keyed by served path. */
export async function renderedMarkdownFilesFor(
  content: AuthoredContent,
  options?: { mediaForEntry?: MediaForEntry },
): Promise<Map<string, string>> {
  const renders = markdownFilesFor(content, options).map(async ({ path, render }) => [path, await render()] as const);
  return new Map(await Promise.all(renders));
}
