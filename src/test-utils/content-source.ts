import { createElement } from "react";

import type { ContentSource, EntryBodyChunks } from "#/lib/content/catalog.ts";
import { entryKey, stylesheetFilePathOf } from "#/lib/content/entry-file.ts";

import type { MDXContent } from "mdx/types";

export const CONTENT_DIRECTORY_PATH = "/content";

export interface FakeDocument {
  frontmatter?: unknown;
  body?: MDXContent;
  styles?: { entry?: string };
  bodyChunks?: EntryBodyChunks;
}

const ENTRY_FILE_PATH_PATTERN = /^([^/]+)\/([^/]+)\.mdx$/; // The shape a fake document is keyed by, matching the entries `import.meta.glob("/content/*/*.mdx")` resolves.
const ENTRY_DATE = "2026-07-19";

const fakeBody =
  (filePath: string): MDXContent =>
  () =>
    createElement("p", null, `The body of ${filePath}.`);

export function frontmatterOf(title: string, overrides: Record<string, unknown> = {}) {
  return { title, description: `About ${title}.`, date: ENTRY_DATE, ...overrides };
}

export function fakeContentSource(
  documents: Record<string, FakeDocument>,
  overrides: Partial<ContentSource> = {},
): ContentSource {
  const source: ContentSource = {
    rootDirectoryPath: CONTENT_DIRECTORY_PATH,
    frontmatterModules: {},
    bodyModules: {},
    stylesheetModules: {},
    bodyChunks: {},
  };

  for (const [entryFilePath, document] of Object.entries(documents)) {
    const [, directoryName, slug] = ENTRY_FILE_PATH_PATTERN.exec(entryFilePath) ?? [];

    if (directoryName === undefined || slug === undefined) {
      throw new Error(`Invalid fake document key "${entryFilePath}"; expected format "<directory>/<slug>.mdx".`);
    }

    const filePath = `${CONTENT_DIRECTORY_PATH}/${entryFilePath}`;
    const key = entryKey(directoryName, slug);
    const body = document.body ?? fakeBody(filePath);

    source.frontmatterModules[filePath] = { default: document.frontmatter ?? frontmatterOf(key) };
    source.bodyModules[filePath] = () => Promise.resolve({ default: body });

    if (document.styles) {
      const styles = document.styles;
      source.stylesheetModules[stylesheetFilePathOf(filePath)] = () => Promise.resolve({ default: styles });
    }

    if (document.bodyChunks) {
      source.bodyChunks[key] = document.bodyChunks;
    }
  }

  return { ...source, ...overrides };
}
