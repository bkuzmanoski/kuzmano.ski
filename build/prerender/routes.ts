import { join, sep } from "node:path";

import { COLLECTIONS, PAGES_DIRECTORY_NAME, PAGE_SLUGS } from "#/config/content.ts";
import { FEATURE_ROUTE_SPECS } from "#/config/feature-routes.ts";
import { SITE_TIME_ZONE } from "#/config/site.ts";
import { entryFileName } from "#/lib/content/entry-file.ts";
import { MEDIA_SEGMENT } from "#/lib/content/paths.ts";
import { calendarDateIn } from "#/lib/datetime.ts";
import { errorMessageOf } from "#/lib/errors.ts";
import { FEATURE_ROUTES, collectionRoute, entryRoute, isDeclaredPageSlug, pageRoute } from "#/site/routes.ts";

import { newestDate, publishedEntries, readAuthoredContent } from "../content/authored-content.ts";
import { URL_SAFE_NAME } from "../content/listing.ts";
import { CLIENT_ENVIRONMENT } from "../environments.ts";
import { CONTENT_DIRECTORY_PATH, fromContent } from "../paths.ts";

import type { AuthoredContent } from "../content/authored-content.ts";
import type { Plugin } from "vite";

interface PrerenderRoute {
  path: string;
  sitemap?: { lastmod?: string; exclude?: boolean };
}

/** A route claimed by content. */
interface ContentRoute {
  /** The file or directory name, which becomes a URL segment as authored. */
  name: string;
  path: string;
  /** Authored content file or directory, used in validation errors. */
  sourcePath: string;
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

const problemFor = (offendingPaths: Array<string>, message: (offendingPaths: string) => string): Array<string> =>
  offendingPaths.length > 0 ? [message(offendingPaths.join(", "))] : [];

/** Returns validation messages for authored content that cannot be converted into routes. */
export function contentProblemsIn(
  content: AuthoredContent,
  today: string, // `YYYY-MM-DD`
): Array<string> {
  const { pages, collections } = content;
  const claimedRoutes = contentRoutes(content);
  const contentDirectories = [{ ...pages, name: PAGES_DIRECTORY_NAME }, ...collections];
  const allPublishedEntries = [
    ...publishedEntries(pages.entries),
    ...collections.flatMap(({ entries }) => publishedEntries(entries)),
  ];

  return [
    ...problemFor(
      claimedRoutes.filter(({ name }) => !URL_SAFE_NAME.test(name)).map(({ sourcePath }) => sourcePath),
      (offendingPaths) => `URL-unsafe content file or folder name(s): ${offendingPaths}.`,
    ),
    ...problemFor(
      claimedRoutes.filter(({ path }) => RESERVED_ROUTES.includes(path)).map(({ sourcePath }) => sourcePath),
      (offendingPaths) => `Content shadowing reserved route(s): ${offendingPaths}.`,
    ),
    ...problemFor(
      PAGE_SLUGS.filter((slug) => !pages.entries.some((entry) => entry.slug === slug)).map((slug) =>
        join(CONTENT_DIRECTORY_PATH, PAGES_DIRECTORY_NAME, entryFileName(slug)),
      ),
      (offendingPaths) => `Page(s) declared with no corresponding content file: ${offendingPaths}.`,
    ),
    ...problemFor(
      pages.entries
        .filter(({ slug }) => collections.some((collection) => collection.name === slug))
        .map(({ entryFilePath }) => join(CONTENT_DIRECTORY_PATH, entryFilePath)),
      (offendingPaths) => `Page(s) shadowed by a collection: ${offendingPaths}.`,
    ),
    ...problemFor(
      Object.keys(COLLECTIONS)
        .filter((name) => !collections.some((collection) => collection.name === name))
        .map((name) => `${join(CONTENT_DIRECTORY_PATH, name)}/`),
      (offendingPaths) => `Collection(s) declared with no corresponding content directory: ${offendingPaths}.`,
    ),
    ...problemFor(
      collections
        .filter(({ name }) => !(name in COLLECTIONS))
        .map(({ name }) => `${join(CONTENT_DIRECTORY_PATH, name)}/`),
      (offendingPaths) => `Content director(ies) with no declared collection: ${offendingPaths}.`,
    ),
    // An entry-named subdirectory contains that entry's media. A nested content directory has no route.
    ...problemFor(
      contentDirectories.flatMap(({ name, entries, subdirectoryNames }) =>
        subdirectoryNames
          .filter((subdirectoryName) => !entries.some(({ slug }) => slug === subdirectoryName))
          .map((subdirectoryName) => `${join(CONTENT_DIRECTORY_PATH, name, subdirectoryName)}/`),
      ),
      (offendingPaths) => `Content director(ies) with no matching entry: ${offendingPaths}.`,
    ),
    ...problemFor(
      allPublishedEntries
        .filter(({ date }) => date !== undefined && date > today)
        .map(({ entryFilePath, date }) => `${join(CONTENT_DIRECTORY_PATH, entryFilePath)} (${date})`),
      (offendingPaths) => `Published entr(ies) dated after today: ${offendingPaths}.`,
    ),
  ];
}

/**
 * Returns all routes to prerender from validated content.
 *
 * Built-in discovery cannot produce a complete, duplicate-free list: `autoStaticPathsDiscovery` omits dynamic routes,
 * `crawlLinks` omits unlinked routes, and using both duplicates index routes.
 */
export function routesFor({ pages, collections }: AuthoredContent): Array<PrerenderRoute> {
  const publishedPages = publishedEntries(pages.entries);
  const publishedCollections = collections.map(({ name, entries }) => ({ name, entries: publishedEntries(entries) }));
  const allPublishedEntries = [...publishedPages, ...publishedCollections.flatMap(({ entries }) => entries)];
  const siteLastModifiedDate = newestDate(allPublishedEntries);

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
    ...Object.values(FEATURE_ROUTE_SPECS).map(({ route: featureRoute, isIndexed }) =>
      isIndexed ? route(featureRoute, siteLastModifiedDate) : unlistedRoute(featureRoute),
    ),
  ];
}

/** The routes to prerender, read from the content on disk. */
export const prerenderRoutes = (): Array<PrerenderRoute> => routesFor(readAuthoredContent());

const contentProblemsOnDisk = () =>
  contentProblemsIn(readAuthoredContent(), calendarDateIn(SITE_TIME_ZONE, new Date()));

/** How long the dev server waits after a change under `/content` for further changes before it rereads the content. */
const CONTENT_CHANGES_SETTLE_DELAY_MS = 100;

/** Validates content before prerendering, failing builds and reporting changed problems as dev-server warnings. */
export function contentProblemsPlugin(): Plugin {
  return {
    name: "kuzmano.ski:content-problems",
    applyToEnvironment: (environment) => environment.name === CLIENT_ENVIRONMENT,
    buildStart() {
      if (this.environment.config.command !== "build") {
        return;
      }

      const problems = contentProblemsOnDisk();

      if (problems.length > 0) {
        this.error(problems.join("\n"));
      }
    },
    configureServer(server) {
      const contentDirectoryPrefix = `${fromContent()}${sep}`; // The separator keeps a sibling directory (e.g., `/content-drafts`) from matching.

      let reportedProblems = "";

      const reportProblems = () => {
        let problems: string;

        try {
          problems = contentProblemsOnDisk().join("\n");
        } catch (cause) {
          problems = `The content could not be read: ${errorMessageOf(cause)}`;
        }

        if (problems !== "" && problems !== reportedProblems) {
          server.config.logger.warn(problems, { timestamp: true });
        }

        reportedProblems = problems;
      };

      reportProblems();

      // Rereads the content once a burst of changes settles (e.g., a checkout that rewrites many files at once).
      let pendingReport: ReturnType<typeof setTimeout> | undefined;

      server.watcher.on("all", (_event, path) => {
        if (path.startsWith(contentDirectoryPrefix)) {
          clearTimeout(pendingReport);
          pendingReport = setTimeout(reportProblems, CONTENT_CHANGES_SETTLE_DELAY_MS);
        }
      });
    },
  };
}
