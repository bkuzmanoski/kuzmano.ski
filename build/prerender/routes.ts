import { join } from "node:path";

import { CONTACT_ROUTE } from "#/config/contact.ts";
import { COLLECTIONS, PAGES_DIRECTORY_NAME, PAGE_SLUGS } from "#/config/content.ts";
import { entryFileName } from "#/lib/content/entry-file.ts";
import { MEDIA_SEGMENT } from "#/lib/content/paths.ts";
import { FEATURE_ROUTES, collectionRoute, entryRoute, isDeclaredPageSlug, pageRoute } from "#/site/routes.ts";

import { newestDate, publishedEntries, readAuthoredContent } from "../content/authored-content.ts";
import { URL_SAFE_NAME } from "../content/listing.ts";
import { CONTENT_DIRECTORY_PATH } from "../paths.ts";

import type { AuthoredContent } from "../content/authored-content.ts";

interface PrerenderRoute {
  path: string;
  sitemap?: { lastmod?: string; exclude?: boolean };
}

// A route claimed by content.
interface ContentRoute {
  name: string; // The file or directory name, which becomes a URL segment as written.
  path: string;
  sourcePath: string; // Authored content file or directory, used in validation errors.
}

const RESERVED_ROUTES: Array<string> = [...FEATURE_ROUTES, collectionRoute(MEDIA_SEGMENT)];

const contentRoutes = ({ pages, collections }: AuthoredContent): Array<ContentRoute> => [
  ...pages.entries.map(({ slug, entryFilePath }) => ({
    name: slug,
    path: pageRoute(slug),
    sourcePath: join(CONTENT_DIRECTORY_PATH, entryFilePath),
  })),
  ...collections.flatMap(({ name, entries }) =>
    entries.map(({ slug, entryFilePath }) => ({
      name: slug,
      path: entryRoute(name, slug),
      sourcePath: join(CONTENT_DIRECTORY_PATH, entryFilePath),
    })),
  ),
  ...collections.map(({ name }) => ({
    name,
    path: collectionRoute(name),
    sourcePath: `${join(CONTENT_DIRECTORY_PATH, name)}/`,
  })),
];

const route = (path: string, lastmod: string | undefined): PrerenderRoute =>
  lastmod ? { path, sitemap: { lastmod } } : { path };
const unlistedRoute = (path: string): PrerenderRoute => ({ path, sitemap: { exclude: true } });

function rejectAny(offendingPaths: Array<string>, message: (offendingPaths: string) => string): void {
  if (offendingPaths.length > 0) {
    throw new Error(message(offendingPaths.join(", ")));
  }
}

/**
 * Validates the authored content and returns the complete list of routes to prerender.
 *
 * The built-in discovery options cannot produce a complete, duplicate-free list:
 * `autoStaticPathsDiscovery` misses dynamic routes, while `crawlLinks` misses
 * unlinked routes. Using both emits index routes twice.
 */
export function routesFor(content: AuthoredContent): Array<PrerenderRoute> {
  const { pages, collections } = content;
  const claimedRoutes = contentRoutes(content);

  rejectAny(
    claimedRoutes.filter(({ name }) => !URL_SAFE_NAME.test(name)).map(({ sourcePath }) => sourcePath),
    (offendingPaths) => `URL-unsafe content file or folder name(s): ${offendingPaths}.`,
  );

  // Checked before the `COLLECTIONS` lookups below so a collection taking a reserved route is
  // reported for that conflict instead of for missing a title.
  rejectAny(
    claimedRoutes.filter(({ path }) => RESERVED_ROUTES.includes(path)).map(({ sourcePath }) => sourcePath),
    (offendingPaths) => `Content shadowing reserved route(s): ${offendingPaths}.`,
  );

  rejectAny(
    PAGE_SLUGS.filter((slug) => !pages.entries.some((entry) => entry.slug === slug)).map((slug) =>
      join(CONTENT_DIRECTORY_PATH, PAGES_DIRECTORY_NAME, entryFileName(slug)),
    ),
    (offendingPaths) => `Page(s) declared with no corresponding content file: ${offendingPaths}`,
  );

  rejectAny(
    pages.entries
      .filter(({ slug }) => collections.some((collection) => collection.name === slug))
      .map(({ entryFilePath }) => join(CONTENT_DIRECTORY_PATH, entryFilePath)),
    (offendingPaths) => `Page(s) shadowed by a collection: ${offendingPaths}.`,
  );

  rejectAny(
    Object.keys(COLLECTIONS)
      .filter((name) => !collections.some((collection) => collection.name === name))
      .map((name) => `${join(CONTENT_DIRECTORY_PATH, name)}/`),
    (offendingPaths) => `Collection(s) declared with no corresponding content directory: ${offendingPaths}.`,
  );

  rejectAny(
    collections
      .filter(({ name }) => !(name in COLLECTIONS))
      .map(({ name }) => `${join(CONTENT_DIRECTORY_PATH, name)}/`),
    (offendingPaths) => `Content director(ies) with no declared collection: ${offendingPaths}.`,
  );

  const contentDirectories = [{ ...pages, name: PAGES_DIRECTORY_NAME }, ...collections];

  // An entry-named subdirectory contains that entry's media; nested content directories
  // are unsupported because they do not have a corresponding route.
  rejectAny(
    contentDirectories.flatMap(({ name, entries, subdirectoryNames }) =>
      subdirectoryNames
        .filter((subdirectoryName) => !entries.some(({ slug }) => slug === subdirectoryName))
        .map((subdirectoryName) => `${join(CONTENT_DIRECTORY_PATH, name, subdirectoryName)}/`),
    ),
    (offendingPaths) => `Content director(ies) with no matching entry: ${offendingPaths}.`,
  );

  const publishedPages = publishedEntries(pages.entries);
  const publishedCollections = collections.map(({ name, entries }) => ({ name, entries: publishedEntries(entries) }));
  const siteLastModifiedDate = newestDate([
    ...publishedPages,
    ...publishedCollections.flatMap(({ entries }) => entries),
  ]);

  // The sitemap lists its URLs in this order.
  return [
    route("/", siteLastModifiedDate),
    ...publishedPages.map(({ slug, date }) =>
      isDeclaredPageSlug(slug) ? route(pageRoute(slug), date) : unlistedRoute(pageRoute(slug)),
    ),
    ...publishedCollections.flatMap(({ name, entries }) => [
      route(collectionRoute(name), newestDate(entries) ?? siteLastModifiedDate),
      ...entries.map(({ slug, date }) => route(entryRoute(name, slug), date)),
    ]),
    route(CONTACT_ROUTE, siteLastModifiedDate), // Backed by a window rather than a document, so the content walk above misses it.
  ];
}

/** The routes to prerender, read from the content on disk. */
export const prerenderRoutes = (): Array<PrerenderRoute> => routesFor(readAuthoredContent());
