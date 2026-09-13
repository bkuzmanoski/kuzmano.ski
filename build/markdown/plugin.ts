import { readFile } from "node:fs/promises";

import { COLLECTIONS } from "#/config/content.ts";
import { parseFrontmatter } from "#/lib/content/frontmatter.ts";
import { canonicalUrl, markdownPath } from "#/site/metadata.ts";
import { collectionRoute, entryRoute, pageRoute } from "#/site/routes.ts";

import { byNewestFirst, publishedEntries, readAuthoredContent } from "../content/authored-content.ts";
import { NO_MEDIA_FOR_ENTRY } from "../content/markup/media-rewrite.ts";
import { CLIENT_ENVIRONMENT } from "../environments.ts";
import { requestPathOf } from "../paths.ts";

import { markdownFor } from "./markdown.ts";

import type { AuthoredContent, AuthoredEntry } from "../content/authored-content.ts";
import type { MediaForEntry } from "../content/markup/media-rewrite.ts";
import type { Plugin } from "vite";

/** A Markdown file to serve: the path it is served from, and the function that renders it. */
export interface MarkdownFile {
  path: string;
  render: () => Promise<string>;
}

async function entryMarkdown(entry: AuthoredEntry, route: string, mediaForEntry: MediaForEntry): Promise<string> {
  // Validate the frontmatter even though it is emitted unchanged. A malformed block
  // should fail the build here rather than be included in the Markdown file.
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
    collectionMetadata.description,
    ...(entryListItems.length > 0 ? [entryListItems.join("\n")] : []),
  ];

  return `${markdownSections.join("\n\n")}\n`;
}

/** Returns Markdown files for entries and collection indexes. */
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

/** Emits a Markdown representation for every route. */
export function markdownPlugin({ mediaForEntry = NO_MEDIA_FOR_ENTRY }: { mediaForEntry?: MediaForEntry } = {}): Plugin {
  return {
    name: "kuzmano.ski:markdown",
    applyToEnvironment: (environment) => environment.name === CLIENT_ENVIRONMENT,
    async generateBundle() {
      for (const { path, render } of markdownFilesFor(readAuthoredContent(), { mediaForEntry })) {
        this.emitFile({ type: "asset", fileName: path.slice(1), source: await render() });
      }
    },
    configureServer(server) {
      // Re-read per request so an edit to a content file shows up without a restart.
      server.middlewares.use((request, response, next) => {
        const requestPath = requestPathOf(request);

        if (!requestPath?.endsWith(".md")) {
          next();
          return;
        }

        const markdownFile = markdownFilesFor(readAuthoredContent(), { includeDrafts: true, mediaForEntry }).find(
          (candidate) => candidate.path === requestPath,
        );

        if (!markdownFile) {
          next();
          return;
        }

        markdownFile
          .render()
          .then((markdown) => {
            response.setHeader("content-type", "text/markdown; charset=utf-8");
            response.end(markdown);
          })
          .catch(next);
      });
    },
  };
}
