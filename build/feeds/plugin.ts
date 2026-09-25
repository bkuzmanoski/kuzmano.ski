import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { FEED_CONTENT_TYPE } from "#/config/media-types.ts";
import { CONTENT_SIGNAL, FEED_ICON, FEED_LOGO, FEED_MAX_ENTRIES, SITE_NAME } from "#/config/site.ts";
import { parseFrontmatter } from "#/lib/content/frontmatter.ts";
import { FEEDS } from "#/site/feeds.ts";
import type { FeedMetadata } from "#/site/feeds.ts";
import { canonicalUrl, markdownUrl } from "#/site/metadata.ts";
import { entryRoute } from "#/site/routes.ts";

import { byNewestFirst, publishedEntries, readAuthoredContent } from "../content/authored-content.ts";
import { CLIENT_ENVIRONMENT } from "../environments.ts";
import { requestPathOf } from "../paths.ts";

import { articleContentOf } from "./article.ts";
import { atomFeed } from "./atom.ts";

import type { FeedEntry } from "./atom.ts";
import type { AuthoredContent, AuthoredEntry } from "../content/authored-content.ts";
import type { AddHeadersRules, HeadersRule } from "../headers.ts";
import type { Plugin } from "vite";

export type DocumentSource = (route: string) => Promise<string | undefined>;
export type ArticleContentCache = Map<string, Promise<string>>;

const FEED_HEADERS_RULE: HeadersRule = {
  description: "Atom is served from a .xml path, which would otherwise be typed as generic XML.",
  pathPatterns: FEEDS.map(({ path }) => path),
  headers: { "Content-Type": FEED_CONTENT_TYPE, "Content-Signal": CONTENT_SIGNAL },
};

const prerenderedDocuments = new Map<string, string>(); // Prerendered document HTML, keyed by route path.

/**
 * Records a prerendered document so its body can be included in a feed.
 *
 * Called from the prerenderer's `onSuccess` in `/vite.config.ts`, which runs before this plugin's
 * `buildApp` handler reads what it collected.
 */
export function captureDocument({ page, html }: { page: { path: string }; html: string }) {
  prerenderedDocuments.set(page.path, html);
}

const articleContentFor = async (route: string, url: string, documentOf: DocumentSource) => {
  const html = await documentOf(route);
  return html ? articleContentOf(html, url) : "";
};

async function feedEntryOf(
  segment: string,
  entry: AuthoredEntry,
  documentOf: DocumentSource,
  articleContents: ArticleContentCache,
): Promise<FeedEntry> {
  const { title, description, date, category } = parseFrontmatter(entry.frontmatter, entry.entryFilePath);
  const route = entryRoute(segment, entry.slug);
  const url = canonicalUrl(route);
  const pendingContent = articleContents.get(route) ?? articleContentFor(route, url, documentOf);

  articleContents.set(route, pendingContent);

  return {
    title,
    description,
    url,
    markdownUrl: markdownUrl(route),
    date,
    category,
    content: await pendingContent,
  };
}

function entriesFor(
  feed: FeedMetadata,
  { collections }: AuthoredContent,
  documentOf: DocumentSource,
  articleContents: ArticleContentCache,
) {
  return collections
    .filter(({ name }) => feed.collections.some((collection) => collection === name))
    .flatMap(({ name, entries }) => publishedEntries(entries).map((entry) => ({ segment: name, entry })))
    .sort((a, b) => byNewestFirst(a.entry, b.entry))
    .slice(0, FEED_MAX_ENTRIES)
    .map(({ segment, entry }) => feedEntryOf(segment, entry, documentOf, articleContents));
}

/**
 * Builds one feed's Atom document from a content tree and a source of prerendered documents. Feeds
 * built with the same `articleContents` read each entry's document once.
 */
export async function feedXmlFor(
  feed: FeedMetadata,
  content: AuthoredContent,
  documentOf: DocumentSource,
  articleContents: ArticleContentCache = new Map(),
): Promise<string> {
  const entries = await Promise.all(entriesFor(feed, content, documentOf, articleContents));
  const updatedDate = entries[0]?.date ?? "1970-01-01"; // The entries are sorted newest first, so the first one is the feed's own newest date.

  return atomFeed({
    title: feed.title,
    subtitle: feed.description,
    author: SITE_NAME,
    icon: canonicalUrl(FEED_ICON),
    logo: canonicalUrl(FEED_LOGO),
    url: canonicalUrl(feed.route),
    selfUrl: canonicalUrl(feed.path),
    updated: updatedDate,
    entries,
  });
}

/** Writes an Atom feed for the site and for each collection from prerendered content. */
export function feedsPlugin({ addHeadersRules }: { addHeadersRules: AddHeadersRules }): Plugin {
  return {
    name: "kuzmano.ski:feeds",
    enforce: "post",
    buildStart() {
      if (this.environment.name === CLIENT_ENVIRONMENT) {
        addHeadersRules([FEED_HEADERS_RULE]);
      }
    },
    buildApp: {
      order: "post",
      async handler(builder) {
        const clientEnvironment = builder.environments[CLIENT_ENVIRONMENT];

        if (!clientEnvironment) {
          return;
        }

        const outputDirectoryAbsolutePath = resolve(
          clientEnvironment.config.root,
          clientEnvironment.config.build.outDir,
        );
        const authoredContent = readAuthoredContent();

        // Every published entry was prerendered, so a route with no document means the build
        // lost one. Writing the feed without it would publish an entry whose body is empty.
        const documentOf: DocumentSource = (route) =>
          prerenderedDocuments.has(route)
            ? Promise.resolve(prerenderedDocuments.get(route))
            : Promise.reject(new Error(`No prerendered document was captured for "${route}".`));

        const articleContents: ArticleContentCache = new Map();

        for (const feed of FEEDS) {
          const feedAbsolutePath = join(outputDirectoryAbsolutePath, feed.path);

          await mkdir(dirname(feedAbsolutePath), { recursive: true });
          await writeFile(feedAbsolutePath, await feedXmlFor(feed, authoredContent, documentOf, articleContents));
        }
      },
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestPath = requestPathOf(request);
        const feed = FEEDS.find((candidate) => candidate.path === requestPath);

        if (!feed) {
          next();
          return;
        }

        const origin = `http://${request.headers.host ?? "localhost"}`;

        // The dev server renders feed entries from source instead of prerendered content. Unavailable routes
        // produce empty entries; responses without exactly one `<article>` reject so the error is visible.
        const documentOf: DocumentSource = (route) =>
          fetch(`${origin}${route}`)
            .then((fetchedResponse) => (fetchedResponse.ok ? fetchedResponse.text() : undefined))
            .catch(() => undefined);

        // Re-read per request so an edit to a content file shows up without a restart.
        feedXmlFor(feed, readAuthoredContent(), documentOf)
          .then((xml) => {
            response.setHeader("content-type", FEED_CONTENT_TYPE);
            response.end(xml);
          })
          .catch(next);
      });
    },
  };
}
