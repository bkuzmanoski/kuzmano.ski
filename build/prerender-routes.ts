import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { COLLECTIONS, PAGES_DIRECTORY, PAGE_SLUGS } from "#/config/content.ts";
import { isRecord } from "#/lib/guards.ts";

import { frontmatterOf } from "./frontmatter.ts";
import { CONTENT_DIRECTORY, ROOT_DIRECTORY } from "./paths.ts";

interface ScannedEntry {
  slug: string;
  draft: boolean;
  date: string | undefined;
}

interface PrerenderRoute {
  path: string;
  sitemap?: { lastmod: string };
}

const URL_SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const entryOf = (path: string, slug: string): ScannedEntry => {
  const frontmatter = frontmatterOf(readFileSync(path, "utf8"));

  if (!isRecord(frontmatter)) {
    return { slug, draft: false, date: undefined };
  }

  return {
    slug,
    draft: frontmatter.draft === true,
    date: typeof frontmatter.date === "string" ? frontmatter.date : undefined,
  };
};

const publishedEntries = (entries: Array<ScannedEntry>) => entries.filter(({ draft }) => !draft);

const newestDate = (entries: Array<ScannedEntry>): string | undefined =>
  entries.reduce<string | undefined>(
    (newest, { date }) => (date !== undefined && (newest === undefined || date > newest) ? date : newest),
    undefined,
  );

const route = (path: string, lastmod: string | undefined): PrerenderRoute =>
  lastmod ? { path, sitemap: { lastmod } } : { path };

const readContentDirectory = (directory: string) => {
  const path = join(ROOT_DIRECTORY, CONTENT_DIRECTORY, directory);
  const entries = readdirSync(path, { withFileTypes: true });

  return {
    entries: entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
      .map((entry) => entryOf(join(path, entry.name), entry.name.replace(/\.mdx$/, ""))),
    subdirectories: entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
  };
};

/**
 * Returns a complete list of routes to prerender.
 *
 * Derived from the file system because the built-in discovery options cannot
 * make a complete, duplicate-free list on their own (`autoStaticPathsDiscovery`
 * misses dynamic routes, `crawlLinks` misses unlinked routes, and enabling both
 * emits index routes twice).
 *
 * Walking the tree validates the content structure and throws if a path is not
 * URL-safe, a declared page has no file, a page conflicts with a collection,
 * a collection has no directory or title, or a directory is nested. The build
 * fails rather than emitting an invalid or ambiguous route.
 */
export function prerenderRoutes(): Array<PrerenderRoute> {
  const directoryNames = readdirSync(join(ROOT_DIRECTORY, CONTENT_DIRECTORY), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const collections = directoryNames
    .filter((name) => name !== PAGES_DIRECTORY)
    .map((name) => ({ name, ...readContentDirectory(name) }));
  const pages = directoryNames.includes(PAGES_DIRECTORY)
    ? readContentDirectory(PAGES_DIRECTORY)
    : { entries: [], subdirectories: [] };

  const unsafeNames = [
    ...collections.filter(({ name }) => !URL_SAFE_NAME.test(name)).map(({ name }) => `${name}/`),
    ...collections.flatMap(({ name, entries }) =>
      entries.filter(({ slug }) => !URL_SAFE_NAME.test(slug)).map(({ slug }) => `${name}/${slug}.mdx`),
    ),
    ...pages.entries
      .filter(({ slug }) => !URL_SAFE_NAME.test(slug))
      .map(({ slug }) => `${PAGES_DIRECTORY}/${slug}.mdx`),
  ];

  if (unsafeNames.length > 0) {
    throw new Error(
      `File and folder name(s) that are not URL-safe: ${unsafeNames.join(", ")}. ` +
        `Use lowercase letters, digits and single hyphens, as the name becomes a URL segment as written.`,
    );
  }

  const missingPages = PAGE_SLUGS.filter((slug) => !pages.entries.some((entry) => entry.slug === slug));

  if (missingPages.length > 0) {
    throw new Error(
      `Page(s) declared with no corresponding file: ${missingPages
        .map((slug) => join(CONTENT_DIRECTORY, PAGES_DIRECTORY, `${slug}.mdx`))
        .join(", ")}`,
    );
  }

  // Unregistered pages are allowed (they can be viewed via a direct link).

  // const unregisteredPages = pages.entries.filter(({ slug }) => !PAGE_SLUGS.some((declared) => declared === slug));

  // if (unregisteredPages.length > 0) {
  //   throw new Error(
  //     `Page(s) missing from PAGE_SLUGS: ${unregisteredPages
  //       .map(({ slug }) => join(CONTENT_DIRECTORY, PAGES_DIRECTORY, `${slug}.mdx`))
  //       .join(", ")}`,
  //   );
  // }

  const shadowedPages = pages.entries.filter(({ slug }) => collections.some((collection) => collection.name === slug));

  if (shadowedPages.length > 0) {
    throw new Error(
      `Page(s) shadowed by a collection: ${shadowedPages
        .map(({ slug }) => `${PAGES_DIRECTORY}/${slug}.mdx vs ${slug}/`)
        .join(", ")}. Rename the page or the collection to avoid a conflict.`,
    );
  }

  const missingCollections = Object.keys(COLLECTIONS).filter(
    (name) => !collections.some((collection) => collection.name === name),
  );

  if (missingCollections.length > 0) {
    throw new Error(`Collection(s) defined with no corresponding content directory: ${missingCollections.join(", ")}`);
  }

  const unregisteredCollections = collections.filter(({ name }) => !(name in COLLECTIONS));

  if (unregisteredCollections.length > 0) {
    throw new Error(
      `Collection director(ies) missing titles: ${unregisteredCollections
        .map(({ name }) => `${join(CONTENT_DIRECTORY, name)}/`)
        .join(", ")}`,
    );
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
        `Use the "category" frontmatter field to organize entries.`,
    );
  }

  const publishedPages = publishedEntries(pages.entries);
  const publishedCollections = collections.map(({ name, entries }) => ({ name, entries: publishedEntries(entries) }));
  const siteLastModifiedDate = newestDate([
    ...publishedPages,
    ...publishedCollections.flatMap(({ entries }) => entries),
  ]);

  return [
    route("/", siteLastModifiedDate),
    ...publishedCollections.flatMap(({ name, entries }) => [
      route(`/${name}`, newestDate(entries) ?? siteLastModifiedDate),
      ...entries.map(({ slug, date }) => route(`/${name}/${slug}`, date)),
    ]),
    ...publishedPages.map(({ slug, date }) => route(`/${slug}`, date)),
  ];
}
