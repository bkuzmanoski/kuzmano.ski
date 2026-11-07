import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { AUTHOR_NAME, CONTENT_SIGNAL, FEED_ICON, FEED_LOGO, FEED_MAX_ENTRIES, SITE_TIME_ZONE } from "#/config/site.ts";
import { parseFrontmatter } from "#/lib/content/frontmatter.ts";
import { FEED_CONTENT_TYPE } from "#/lib/media-types.ts";
import { FEEDS } from "#/site/feeds.ts";
import type { FeedMetadata } from "#/site/feeds.ts";
import { canonicalUrl, markdownUrl } from "#/site/metadata.ts";
import { entryRoute } from "#/site/routes.ts";

import { byNewestFirst, publishedEntries, readAuthoredContent } from "../content/authored-content.ts";
import { CLIENT_ENVIRONMENT } from "../environments.ts";
import { serveGeneratedFiles } from "../generated-file-middleware.ts";

import { articleContentOf } from "./article.ts";
import { atomFeed } from "./atom.ts";

import type { FeedEntry } from "./atom.ts";
import type { AuthoredContent, AuthoredEntry } from "../content/authored-content.ts";
import type { HeadersRule } from "../headers.ts";
import type { Plugin } from "vite";

export type DocumentSource = (route: string) => Promise<string | undefined>;
export type ArticleContentCache = Map<string, Promise<string>>;

type CaptureDocument = (result: { page: { path: string }; html: string }) => void;

export const FEED_HEADERS_RULE: HeadersRule = {
  description: "Feeds are typed as Atom rather than as the generic XML of their .xml paths.",
  pathPatterns: FEEDS.map(({ path }) => path),
  headers: {
    "Content-Type": FEED_CONTENT_TYPE,
    "Cache-Control": "public, max-age=3600",
    "Access-Control-Allow-Origin": "*",
    "Content-Signal": CONTENT_SIGNAL,
  },
};

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
 * Builds one feed's Atom document from a content tree and a source of prerendered documents. Feeds built with the same
 * `articleContents` read each entry's document once.
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
    author: AUTHOR_NAME,
    authorUrl: canonicalUrl("/"),
    icon: canonicalUrl(FEED_ICON),
    logo: canonicalUrl(FEED_LOGO),
    url: canonicalUrl(feed.route),
    selfUrl: canonicalUrl(feed.path),
    updated: updatedDate,
    timeZone: SITE_TIME_ZONE,
    entries,
  });
}

/**
 * Creates the plugin that emits an Atom feed for the site and for each collection from prerendered content, and the
 * `captureDocument` callback that records each prerendered document for it.
 *
 * `captureDocument` is called from the prerenderer's `onSuccess`, which runs before the plugin's `buildApp` handler
 * reads what it recorded. TanStack Start prerenders from a `buildApp` handler of the same order, so `vite.config.ts`
 * must list this plugin after `tanstackStart()`.
 */
export function atomFeeds(): {
  plugin: Plugin;
  captureDocument: CaptureDocument;
} {
  const prerenderedDocuments = new Map<string, string>(); // Prerendered document HTML, keyed by route path.

  const captureDocument: CaptureDocument = ({ page, html }) => {
    prerenderedDocuments.set(page.path, html);
  };

  const plugin: Plugin = {
    name: "kuzmano.ski:feeds",
    enforce: "post",
    buildApp: {
      order: "post",
      async handler(builder) {
        const clientEnvironment = builder.environments[CLIENT_ENVIRONMENT];

        if (!clientEnvironment) {
          return;
        }

        // The prerenderer captures at least `/`, so an empty map means this handler ran before prerendering.
        if (prerenderedDocuments.size === 0) {
          throw new Error(
            "The feeds plugin ran before prerendering captured any document. List it after `tanstackStart()` in `vite.config.ts`.",
          );
        }

        const outputDirectoryAbsolutePath = resolve(
          clientEnvironment.config.root,
          clientEnvironment.config.build.outDir,
        );
        const authoredContent = readAuthoredContent();

        // Every published entry was prerendered, so a route with no document means the build lost one. Emitting the
        // feed without it would publish an entry with an empty body.
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
      serveGeneratedFiles(server, (requestPath, request) => {
        const feed = FEEDS.find((candidate) => candidate.path === requestPath);

        if (!feed) {
          return null;
        }

        const origin = `http://${request.headers.host ?? "localhost"}`;

        // The dev server renders feed entries from source instead of prerendered content. Unavailable routes produce
        // empty entries; responses without exactly one `<article>` reject so the error is visible.
        const documentOf: DocumentSource = (route) =>
          fetch(`${origin}${route}`)
            .then((fetchedResponse) => (fetchedResponse.ok ? fetchedResponse.text() : undefined))
            .catch(() => undefined);

        // Re-read per request so an edit to a content file shows up without a restart.
        return feedXmlFor(feed, readAuthoredContent(), documentOf).then((xml) => ({
          contentType: FEED_CONTENT_TYPE,
          contents: xml,
        }));
      });
    },
  };

  return { plugin, captureDocument };
}
