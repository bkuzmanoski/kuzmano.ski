import { COLLECTIONS, PAGE_SLUGS } from "#/config/content.ts";
import { PLAIN_TEXT_CONTENT_TYPE } from "#/config/media-types.ts";
import { CONTENT_SIGNAL, SITE_DESCRIPTION, SITE_NAME } from "#/config/site.ts";
import { parseFrontmatter } from "#/lib/content/frontmatter.ts";
import { markdownPath } from "#/lib/content/paths.ts";
import { SITE_FEED } from "#/site/feeds.ts";
import { LLMS_TXT_FILE_NAME, LLMS_TXT_PATH, canonicalUrl, markdownUrl } from "#/site/metadata.ts";
import { entryRoute, pageRoute } from "#/site/routes.ts";

import { byNewestFirst, publishedEntries } from "../content/authored-content.ts";
import { CLIENT_ENVIRONMENT } from "../environments.ts";
import { requestPathOf } from "../paths.ts";

import { asOneLine, listOf, markdownFrom, paragraphOf, textNode, textParagraph } from "./nodes.ts";

import type { MarkdownTokenCounts } from "./token-count.ts";
import type { AuthoredContent, AuthoredEntry } from "../content/authored-content.ts";
import type { ContentNode } from "../content/markup/tree.ts";
import type { AddHeadersRules, HeadersRule } from "../headers.ts";
import type { Plugin, ViteDevServer } from "vite";

const PAGES_SECTION_HEADING = "Pages";
const OPTIONAL_SECTION_HEADING = "Optional";

const LLMS_TXT_BODY_PARAGRAPH = paragraphOf([
  textNode("Each page and entry on this site is also written as Markdown: append "),
  { type: "inlineCode", value: ".md" },
  textNode(" to a path, or send "),
  { type: "inlineCode", value: "Accept: text/markdown" },
  textNode(`.
The links to pages and entries below address that Markdown, each annotated with an estimate of the tokens it costs to read.`),
]);

function tokenNoteFor(markdownFilePath: string, tokenCounts: MarkdownTokenCounts): string {
  const tokenCount = tokenCounts[markdownFilePath];

  if (tokenCount === undefined) {
    throw new Error(`"${markdownFilePath}" is listed in \`${LLMS_TXT_FILE_NAME}\` but has no token count.`);
  }

  return `(~${tokenCount} tokens)`;
}

const listItemOf = (title: string, url: string, notes: Array<string>): Array<ContentNode> => {
  const note = notes.filter(Boolean).join(" ");
  return [paragraphOf([{ type: "link", url, children: [textNode(title)] }, ...(note ? [textNode(`: ${note}`)] : [])])];
};

function entryListItemOf(entry: AuthoredEntry, route: string, tokenCounts: MarkdownTokenCounts): Array<ContentNode> {
  const { title, description } = parseFrontmatter(entry.frontmatter, entry.entryFilePath);
  return listItemOf(title, markdownUrl(route), [
    asOneLine(description),
    tokenNoteFor(markdownPath(route), tokenCounts),
  ]);
}

const sectionOf = (heading: string, items: Array<Array<ContentNode>>): Array<ContentNode> => [
  { type: "heading", depth: 2, children: [textNode(heading)] },
  listOf(items),
];

/**
 * Returns the site's `llms.txt`, listing every published page and entry as Markdown.
 *
 * Throws when a listed page or entry has no token count, naming its Markdown path.
 */
export function llmsTxtFor({ pages, collections }: AuthoredContent, tokenCounts: MarkdownTokenCounts): string {
  const publishedPages = publishedEntries(pages.entries);
  const pageItems = PAGE_SLUGS.flatMap((slug) => {
    const entry = publishedPages.find((candidate) => candidate.slug === slug);
    return entry ? [entryListItemOf(entry, pageRoute(slug), tokenCounts)] : [];
  });
  const listedCollections = Object.entries(COLLECTIONS)
    .map(([name, { title }]) => ({
      name,
      title,
      entries: publishedEntries(collections.find((collection) => collection.name === name)?.entries ?? []).sort(
        byNewestFirst,
      ),
    }))
    .filter(({ entries }) => entries.length > 0);
  const optionalItems = [listItemOf("Atom feed", canonicalUrl(SITE_FEED.path), ["New entries across the site."])];

  return markdownFrom([
    { type: "heading", depth: 1, children: [textNode(SITE_NAME)] },
    { type: "blockquote", children: [textParagraph(SITE_DESCRIPTION)] },
    LLMS_TXT_BODY_PARAGRAPH,
    ...(pageItems.length > 0 ? sectionOf(PAGES_SECTION_HEADING, pageItems) : []),
    ...listedCollections.flatMap(({ name, title, entries }) =>
      sectionOf(
        title,
        entries.map((entry) => entryListItemOf(entry, entryRoute(name, entry.slug), tokenCounts)),
      ),
    ),
    ...sectionOf(OPTIONAL_SECTION_HEADING, optionalItems),
  ]);
}

const LLMS_TXT_HEADERS_RULE: HeadersRule = {
  description: "The index written for agents declares how the content it lists may be used.",
  pathPatterns: [LLMS_TXT_PATH],
  headers: { "Content-Signal": CONTENT_SIGNAL },
};

export interface LlmsTxtPluginOptions {
  loadForBuild: () => Promise<string>; // Written from the render the build emits the Markdown files from.
  loadForDevRequest: (server: ViteDevServer) => Promise<string>; // Written from a fresh render, so a request reflects the content on disk.
  addHeadersRules: AddHeadersRules;
}

/** Emits `llms.txt` into the client build, and serves it under `vite dev`. */
export function llmsTxtPlugin({ loadForBuild, loadForDevRequest, addHeadersRules }: LlmsTxtPluginOptions): Plugin {
  return {
    name: "kuzmano.ski:llms-txt",
    applyToEnvironment: (environment) => environment.name === CLIENT_ENVIRONMENT,
    buildStart() {
      addHeadersRules([LLMS_TXT_HEADERS_RULE]);
    },
    async generateBundle() {
      this.emitFile({ type: "asset", fileName: LLMS_TXT_FILE_NAME, source: await loadForBuild() });
    },
    configureServer(server) {
      // Every document is rendered to count its tokens, so the render runs only on a request for `/llms.txt`.
      server.middlewares.use((request, response, next) => {
        if (requestPathOf(request) !== LLMS_TXT_PATH) {
          next();
          return;
        }

        loadForDevRequest(server)
          .then((llmsTxt) => {
            response.setHeader("content-type", PLAIN_TEXT_CONTENT_TYPE);
            response.end(llmsTxt);
          })
          .catch(next);
      });
    },
  };
}
