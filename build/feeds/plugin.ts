import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { FEED_ICON, FEED_LOGO, FEED_MAX_ENTRIES, SITE_NAME } from "#/config/site.ts";
import { parseFrontmatter } from "#/lib/content/schema.ts";
import { FEEDS } from "#/site/feeds.ts";
import type { FeedMetadata } from "#/site/feeds.ts";
import { canonicalUrl, markdownUrl } from "#/site/metadata.ts";

import { byNewestFirst, newestDate, publishedEntries, scanContent } from "../prerender/routes.ts";

import { articleContentOf } from "./article.ts";
import { atomFeed } from "./atom.ts";
import { assertWellFormedXml } from "./xml.ts";

import type { FeedEntry } from "./atom.ts";
import type { ScannedContent, ScannedEntry } from "../prerender/routes.ts";
import type { Plugin } from "vite";

export type PageSource = (route: string) => Promise<string | undefined>;

const NO_CONTENT_DATE = "1970-01-01"; // Fallback for a feed with no entries.

const prerenderedPages = new Map<string, string>(); // Prerendered page HTML, keyed by route path.

/**
 * Records a prerendered page so its body can be included in a feed.
 *
 * Called from the prerenderer's `onSuccess` in `/vite.config.ts`, which runs before this plugin's
 * `buildApp` handler reads what it collected.
 */
export function capturePage({ page, html }: { page: { path: string }; html: string }) {
  prerenderedPages.set(page.path, html);
}

async function feedEntryOf(segment: string, entry: ScannedEntry, pageOf: PageSource): Promise<FeedEntry> {
  const { title, description, date, category } = parseFrontmatter(entry.frontmatter, entry.path);
  const route = `/${segment}/${entry.slug}`;
  const url = canonicalUrl(route);
  const page = await pageOf(route);

  return {
    title,
    description,
    url,
    markdownUrl: markdownUrl(route),
    date,
    category,
    content: page ? articleContentOf(page, url) : "",
  };
}

function entriesFor(feed: FeedMetadata, { collections }: ScannedContent, pageOf: PageSource) {
  return collections
    .filter(({ name }) => feed.collections.some((collection) => collection === name))
    .flatMap(({ name, entries }) => publishedEntries(entries).map((entry) => ({ segment: name, entry })))
    .sort((a, b) => byNewestFirst(a.entry, b.entry))
    .slice(0, FEED_MAX_ENTRIES)
    .map(({ segment, entry }) => feedEntryOf(segment, entry, pageOf));
}

/** Builds one feed's Atom document from a content tree and a source of prerendered pages. */
export async function feedXmlFor(feed: FeedMetadata, content: ScannedContent, pageOf: PageSource): Promise<string> {
  const entries = await Promise.all(entriesFor(feed, content, pageOf));
  const updatedDate =
    entries[0]?.date ??
    newestDate(content.collections.flatMap(({ entries: all }) => publishedEntries(all))) ??
    NO_CONTENT_DATE;

  const xml = atomFeed({
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

  await assertWellFormedXml(xml, feed.path);

  return xml;
}

/** Writes an Atom feed for the site and for each collection from prerendered content. */
export function feedsPlugin(): Plugin {
  return {
    name: "kuzmano.ski:feeds",
    enforce: "post",
    buildApp: {
      order: "post",
      async handler(builder) {
        const clientEnvironment = builder.environments.client;

        if (!clientEnvironment) {
          return;
        }

        const outputDirectory = resolve(clientEnvironment.config.root, clientEnvironment.config.build.outDir);
        const content = scanContent();

        // Every published entry was prerendered, so a route with no page means the build lost one.
        // Writing the feed without it would publish an entry whose body is empty.
        const pageOf: PageSource = (route) =>
          prerenderedPages.has(route)
            ? Promise.resolve(prerenderedPages.get(route))
            : Promise.reject(new Error(`No prerendered page was captured for "${route}".`));

        try {
          for (const feed of FEEDS) {
            const path = join(outputDirectory, feed.path);

            await mkdir(dirname(path), { recursive: true });
            await writeFile(path, await feedXmlFor(feed, content, pageOf));
          }
        } finally {
          prerenderedPages.clear(); // Released once written so a rebuild under `--watch` reads only the pages it just prerendered.
        }
      },
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split("?")[0];
        const feed = FEEDS.find((candidate) => candidate.path === path);

        if (!feed) {
          next();
          return;
        }

        const origin = `http://${request.headers.host ?? "localhost"}`;

        // The dev server does not prerender content, so the feed is built from the source files. A
        // page that fails to render leaves its entry without content rather than failing the request.
        const pageOf: PageSource = (route) =>
          fetch(`${origin}${route}`)
            .then((page) => (page.ok ? page.text() : undefined))
            .catch(() => undefined);

        // Rescanned per request so an edit to a content file shows up without a restart.
        feedXmlFor(feed, scanContent(), pageOf)
          .then((xml) => {
            response.setHeader("content-type", "application/atom+xml; charset=utf-8");
            response.end(xml);
          })
          .catch(next);
      });
    },
  };
}
