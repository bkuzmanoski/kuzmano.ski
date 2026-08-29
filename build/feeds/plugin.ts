import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { FEEDS, FEED_ICON, FEED_LOGO, SITE_NAME, canonicalUrl } from "#/config/site.ts";
import type { FeedMetadata } from "#/config/site.ts";
import { parseFrontmatter } from "#/content/schema.ts";

import { byNewestFirst, newestDate, publishedEntries, scanContent } from "../prerender/routes.ts";

import { articleContentOf } from "./article.ts";
import { atomFeed } from "./atom.ts";

import type { FeedEntry } from "./atom.ts";
import type { ScannedContent, ScannedEntry } from "../prerender/routes.ts";
import type { Plugin } from "vite";

type PageSource = (route: string) => Promise<string | undefined>;

const prerenderedPages = new Map<string, string>(); // Prerendered page HTML, keyed by route path.

/** Records a prerendered page so its body can be included in a feed. */
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
    markdownUrl: `${url}.md`,
    date,
    category,
    content: page ? articleContentOf(page, url) : "",
  };
}

function entriesFor(feed: FeedMetadata, { collections }: ScannedContent, pageOf: PageSource) {
  return collections
    .filter(({ name }) => (feed.collections as Array<string>).includes(name))
    .flatMap(({ name, entries }) => publishedEntries(entries).map((entry) => ({ segment: name, entry })))
    .sort((a, b) => byNewestFirst(a.entry, b.entry))
    .map(({ segment, entry }) => feedEntryOf(segment, entry, pageOf));
}

async function feedXml(feed: FeedMetadata, content: ScannedContent, pageOf: PageSource): Promise<string> {
  const entries = await Promise.all(entriesFor(feed, content, pageOf));
  const everyEntry = content.collections.flatMap(({ entries: all }) => publishedEntries(all));

  return atomFeed({
    title: feed.title,
    subtitle: feed.description,
    author: SITE_NAME,
    icon: canonicalUrl(FEED_ICON),
    logo: canonicalUrl(FEED_LOGO),
    url: canonicalUrl(feed.route),
    selfUrl: canonicalUrl(feed.path),
    updated: entries[0]?.date ?? newestDate(everyEntry) ?? new Date().toISOString().slice(0, 10),
    entries,
  });
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
        const pageOf: PageSource = (route) => Promise.resolve(prerenderedPages.get(route));

        for (const feed of FEEDS) {
          const path = join(outputDirectory, feed.path);

          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, await feedXml(feed, content, pageOf));
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

        // The dev server does not prerender content, so the feed is built from the source files.
        const origin = `http://${request.headers.host ?? "localhost"}`;
        const pageOf: PageSource = (route) =>
          fetch(`${origin}${route}`)
            .then((page) => (page.ok ? page.text() : undefined))
            .catch(() => undefined);

        // Rescanned per request so an edit to a content file shows up without a restart.
        feedXml(feed, scanContent(), pageOf)
          .then((xml) => {
            response.setHeader("content-type", "application/atom+xml; charset=utf-8");
            response.end(xml);
          })
          .catch(next);
      });
    },
  };
}
