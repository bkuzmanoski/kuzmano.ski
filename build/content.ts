import { readdirSync } from "node:fs";
import { join } from "node:path";

import { PAGES_DIRECTORY } from "#/config/content";
import { COLLECTION_TITLES } from "#/config/navigation";

import { CONTENT_DIRECTORY, ROOT_DIRECTORY } from "./paths.ts";

const readContentDirectory = (directory: string) => {
  const entries = readdirSync(join(ROOT_DIRECTORY, CONTENT_DIRECTORY, directory), { withFileTypes: true });
  return {
    slugs: entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
      .map((entry) => entry.name.replace(/\.mdx$/, "")),
    subdirectories: entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
  };
};

/**
 * Returns a complete list of pages to prerender.
 *
 * Derived from the file system because the built-in discovery options cannot
 * make a complete, duplicate-free list on their own (`autoStaticPathsDiscovery`
 * misses dynamic routes, `crawlLinks` misses unlinked pages, and enabling both
 * emits index routes twice).
 */
export function content(): Array<{ path: string }> {
  const directoryNames = readdirSync(join(ROOT_DIRECTORY, CONTENT_DIRECTORY), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const collections = directoryNames
    .filter((name) => name !== PAGES_DIRECTORY)
    .map((name) => ({ name, ...readContentDirectory(name) }));
  const pages = directoryNames.includes(PAGES_DIRECTORY)
    ? readContentDirectory(PAGES_DIRECTORY)
    : { slugs: [], subdirectories: [] };

  const shadowedPages = pages.slugs.filter((slug) => collections.some((collection) => collection.name === slug));

  if (shadowedPages.length > 0) {
    throw new Error(
      `Page(s) shadowed by a collection: ${shadowedPages
        .map((slug) => `${PAGES_DIRECTORY}/${slug}.mdx vs ${slug}/`)
        .join(", ")}. Rename the page or the collection to avoid a conflict.`,
    );
  }

  const unregisteredCollections = collections.filter(({ name }) => !(name in COLLECTION_TITLES));

  if (unregisteredCollections.length > 0) {
    throw new Error(
      `Collection director(ies) missing titles: ${unregisteredCollections
        .map(({ name }) => `${join(CONTENT_DIRECTORY, name)}/`)
        .join(", ")}`,
    );
  }

  const missingCollections = Object.keys(COLLECTION_TITLES).filter(
    (name) => !collections.some((collection) => collection.name === name),
  );

  if (missingCollections.length > 0) {
    throw new Error(`Collection(s) defined with no corresponding content directory: ${missingCollections.join(", ")}`);
  }

  const nestedDirectories = [
    ...collections.flatMap(({ name, subdirectories }) =>
      subdirectories.map((subdirectory) => `${join(CONTENT_DIRECTORY, name, subdirectory)}/`),
    ),
    ...pages.subdirectories.map((subdirectory) => `${join(CONTENT_DIRECTORY, PAGES_DIRECTORY, subdirectory)}/`),
  ];

  if (nestedDirectories.length > 0) {
    throw new Error(
      `Nested content director(ies) are not supported: ${nestedDirectories.join(", ")}. ` +
        `Use the "category" frontmatter field to organize pages.`,
    );
  }

  const paths = [
    "/",
    ...collections.flatMap(({ name, slugs }) => [`/${name}`, ...slugs.map((slug) => `/${name}/${slug}`)]),
    ...pages.slugs.map((slug) => `/${slug}`),
  ];

  return paths.map((path) => ({ path }));
}
