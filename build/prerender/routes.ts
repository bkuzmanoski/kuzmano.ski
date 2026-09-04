import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { CONTACT_ROUTE } from "#/config/contact.ts";
import { COLLECTIONS, PAGES_DIRECTORY, PAGE_SLUGS } from "#/config/content.ts";
import { byNewestDate } from "#/lib/date.ts";
import { isRecord } from "#/lib/guards.ts";
import { RESERVED_ROUTES, collectionRoute, entryRoute, pageRoute } from "#/site/content-routes.ts";

import { frontmatterOf } from "../frontmatter.ts";
import { CONTENT_DIRECTORY, fromRoot } from "../paths.ts";

export interface ScannedEntry {
  slug: string;
  path: string;
  frontmatter: unknown;
  draft: boolean;
  date: string | undefined;
}

export interface ScannedDirectory {
  entries: Array<ScannedEntry>;
  subdirectories: Array<string>;
}

export interface ScannedContent {
  pages: ScannedDirectory;
  collections: Array<ScannedDirectory & { name: string }>;
}

interface PrerenderRoute {
  path: string;
  sitemap?: { lastmod?: string; exclude?: boolean };
}

const URL_SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const publishedEntries = (entries: Array<ScannedEntry>) => entries.filter(({ draft }) => !draft);
export const byNewestFirst = (a: ScannedEntry, b: ScannedEntry) => byNewestDate(a.date, b.date);
export const newestDate = (entries: Array<ScannedEntry>): string | undefined =>
  entries.reduce<string | undefined>(
    (newest, { date }) => (date && (!newest || date > newest) ? date : newest),
    undefined,
  );

const entryOf = (path: string, slug: string): ScannedEntry => {
  const frontmatter = frontmatterOf(readFileSync(path, "utf8"));

  if (!isRecord(frontmatter)) {
    return { slug, path, frontmatter, draft: false, date: undefined };
  }

  return {
    slug,
    path,
    frontmatter,
    draft: frontmatter.draft === true,
    date: typeof frontmatter.date === "string" ? frontmatter.date : undefined,
  };
};

const route = (path: string, lastmod: string | undefined): PrerenderRoute =>
  lastmod ? { path, sitemap: { lastmod } } : { path };

const isRegisteredPage = (slug: string) => (PAGE_SLUGS as ReadonlyArray<string>).includes(slug);
const unlistedRoute = (path: string): PrerenderRoute => ({ path, sitemap: { exclude: true } });
const readContentDirectory = (directory: string): ScannedDirectory => {
  const path = fromRoot(join(CONTENT_DIRECTORY, directory));
  const dirents = readdirSync(path, { withFileTypes: true });

  return {
    entries: dirents
      .filter((dirent) => dirent.isFile() && dirent.name.endsWith(".mdx"))
      .map((dirent) => entryOf(join(path, dirent.name), dirent.name.replace(/\.mdx$/, ""))),
    subdirectories: dirents.filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name),
  };
};

/** Walks `/content`, reading the frontmatter of every entry it finds. */
export function scanContent(): ScannedContent {
  const directoryNames = readdirSync(fromRoot(CONTENT_DIRECTORY), { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
  return {
    pages: directoryNames.includes(PAGES_DIRECTORY)
      ? readContentDirectory(PAGES_DIRECTORY)
      : { entries: [], subdirectories: [] },
    collections: directoryNames
      .filter((name) => name !== PAGES_DIRECTORY)
      .map((name) => ({ name, ...readContentDirectory(name) })),
  };
}

/**
 * Validates a scanned content tree and returns the complete list of routes to prerender.
 *
 * The built-in discovery options cannot produce a complete, duplicate-free list:
 * `autoStaticPathsDiscovery` misses dynamic routes, while `crawlLinks` misses
 * unlinked routes. Using both emits index routes twice.
 *
 * Takes the tree as a value so the validation messages can be exercised without content on disk.
 */
export function routesFor({ pages, collections }: ScannedContent): Array<PrerenderRoute> {
  const unsafeNames = [
    ...pages.entries
      .filter(({ slug }) => !URL_SAFE_NAME.test(slug))
      .map(({ slug }) => `${PAGES_DIRECTORY}/${slug}.mdx`),
    ...collections.flatMap(({ name, entries }) =>
      entries.filter(({ slug }) => !URL_SAFE_NAME.test(slug)).map(({ slug }) => `${name}/${slug}.mdx`),
    ),
    ...collections.filter(({ name }) => !URL_SAFE_NAME.test(name)).map(({ name }) => `${name}/`),
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
    ...pages.subdirectories.map((subdirectory) => `${join(CONTENT_DIRECTORY, PAGES_DIRECTORY, subdirectory)}/`),
    ...collections.flatMap(({ name, subdirectories }) =>
      subdirectories.map((subdirectory) => `${join(CONTENT_DIRECTORY, name, subdirectory)}/`),
    ),
  ];

  if (nestedDirectories.length > 0) {
    throw new Error(
      `Nested content director(ies) are not supported: ${nestedDirectories.join(", ")}. ` +
        `Use the "category" frontmatter field to organize entries.`,
    );
  }

  const reservedRouteConflicts = [
    ...pages.entries.map(({ slug }) => ({
      path: pageRoute(slug),
      source: join(CONTENT_DIRECTORY, PAGES_DIRECTORY, `${slug}.mdx`),
    })),
    ...collections.flatMap(({ name, entries }) =>
      entries.map(({ slug }) => ({
        path: entryRoute(name, slug),
        source: join(CONTENT_DIRECTORY, name, `${slug}.mdx`),
      })),
    ),
    ...collections.map(({ name }) => ({ path: collectionRoute(name), source: `${join(CONTENT_DIRECTORY, name)}/` })),
  ].filter(({ path }) => RESERVED_ROUTES.includes(path));

  if (reservedRouteConflicts.length > 0) {
    throw new Error(
      `Content shadowing reserved route(s): ${reservedRouteConflicts
        .map(({ path, source }) => `${source} vs ${path}`)
        .join(", ")}.`,
    );
  }

  const publishedPages = publishedEntries(pages.entries);
  const publishedCollections = collections.map(({ name, entries }) => ({ name, entries: publishedEntries(entries) }));
  const siteLastModifiedDate = newestDate([
    ...publishedPages,
    ...publishedCollections.flatMap(({ entries }) => entries),
  ]);

  // The sitemap lists its URLs in this order, so a collection precedes its entries and the pages
  // come last, rather than following the page, collection entry, collection order used elsewhere.
  return [
    route("/", siteLastModifiedDate),
    route(CONTACT_ROUTE, siteLastModifiedDate), // Backed by a window rather than a document, so the content walk above misses it.
    ...publishedCollections.flatMap(({ name, entries }) => [
      route(collectionRoute(name), newestDate(entries) ?? siteLastModifiedDate),
      ...entries.map(({ slug, date }) => route(entryRoute(name, slug), date)),
    ]),
    ...publishedPages.map(({ slug, date }) =>
      isRegisteredPage(slug) ? route(pageRoute(slug), date) : unlistedRoute(pageRoute(slug)),
    ),
  ];
}

/** The routes to prerender, read from the content on disk. */
export const prerenderRoutes = (): Array<PrerenderRoute> => routesFor(scanContent());
