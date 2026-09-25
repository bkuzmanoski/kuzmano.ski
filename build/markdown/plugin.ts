import { HTML_MEDIA_TYPE, MARKDOWN_CONTENT_TYPE } from "#/config/media-types.ts";
import { CONTENT_SIGNAL } from "#/config/site.ts";
import {
  MARKDOWN_TOKEN_COUNT_HEADER,
  isMarkdownPath,
  markdownRepresentationPathFor,
  prefersMarkdown,
} from "#/site/markdown-negotiation.ts";
import { LLMS_TXT_LINK_HEADER } from "#/site/metadata.ts";

import { readAuthoredContent } from "../content/authored-content.ts";
import { NO_MEDIA_FOR_ENTRY } from "../content/markup/media-rewrite.ts";
import { CLIENT_ENVIRONMENT } from "../environments.ts";
import { requestPathOf } from "../paths.ts";

import { entryDataModuleReaderThrough, readEntryDataModule } from "./entry-data.ts";
import { llmsTxtFor, llmsTxtPlugin } from "./llms-txt.ts";
import { markdownFilesFor, renderedMarkdownFilesFor } from "./markdown-files.ts";
import { markdownTokenCountsPlugin } from "./markdown-token-counts.ts";
import { markdownRendererFor } from "./markdown.ts";
import { estimatedTokenCountIn, estimatedTokenCountsOf } from "./token-count.ts";

import type { EntryDataModuleReader } from "./entry-data.ts";
import type { MarkdownTokenCounts } from "./token-count.ts";
import type { AuthoredContent } from "../content/authored-content.ts";
import type { MediaForEntry } from "../content/markup/media-rewrite.ts";
import type { AddHeadersRules } from "../headers.ts";
import type { Plugin } from "vite";

interface RenderedMarkdown {
  content: AuthoredContent;
  files: Map<string, string>; // Each file's Markdown, keyed by the path it is served from.
  tokenCounts: MarkdownTokenCounts;
}

function requestedMarkdownPathFor(requestPath: string, acceptHeader: string | undefined): string | null {
  if (isMarkdownPath(requestPath)) {
    return requestPath;
  }

  return prefersMarkdown(acceptHeader) ? markdownRepresentationPathFor(requestPath) : null;
}

/**
 * Emits Markdown representations for every entry and collection, exposes estimated token counts
 * for Markdown files through `virtual:markdown-token-counts`, and emits `llms.txt` from the same render.
 */
export function markdownPlugin({
  mediaForEntry = NO_MEDIA_FOR_ENTRY,
  addHeadersRules,
}: {
  mediaForEntry?: MediaForEntry;
  addHeadersRules: AddHeadersRules;
}): Array<Plugin> {
  const renderEntryMarkdown = markdownRendererFor(mediaForEntry);

  // A build imports entry data with `readEntryDataModule`, and `vite dev` through its SSR module runner.
  const renderMarkdown = async (entryDataModuleReader: EntryDataModuleReader): Promise<RenderedMarkdown> => {
    const content = readAuthoredContent();
    const files = await renderedMarkdownFilesFor(content, {
      renderMarkdown: renderEntryMarkdown,
      readEntryDataModule: entryDataModuleReader,
    });

    return { content, files, tokenCounts: estimatedTokenCountsOf(files) };
  };
  const llmsTxtOf = ({ content, tokenCounts }: RenderedMarkdown) => llmsTxtFor(content, tokenCounts);

  let renderedMarkdown: Promise<RenderedMarkdown> | null = null;

  // Whichever environment builds first renders the content; the other awaits the same render. Three
  // build-time hooks reach this: the Markdown files and `llms.txt` emitted in the client environment,
  // and the token counts loaded in the server environment. `vite dev` renders per request instead.
  const ensureRenderedMarkdown = () => (renderedMarkdown ??= renderMarkdown(readEntryDataModule));

  const markdownEmitPlugin: Plugin = {
    name: "kuzmano.ski:markdown-emit",
    applyToEnvironment: (environment) => environment.name === CLIENT_ENVIRONMENT,
    async generateBundle() {
      for (const [path, markdown] of (await ensureRenderedMarkdown()).files) {
        this.emitFile({ type: "asset", fileName: path.slice(1), source: markdown });
      }
    },
    configureServer(server) {
      const readEntryDataModuleInDev = entryDataModuleReaderThrough(server);

      server.middlewares.use((request, response, next) => {
        // Rewrite Markdown-preferring requests to accept HTML before passing them to the router,
        // which responds only to HTML-accepting requests. This matches `asHtmlRequest` in
        // `/src/worker.ts` and lets routes without Markdown render instead of returning `500`.
        const passToRouter = () => {
          if (prefersMarkdown(request.headers.accept)) {
            request.headers.accept = HTML_MEDIA_TYPE;
          }

          next();
        };

        const requestPath = requestPathOf(request);
        const requestedMarkdownPath =
          requestPath === undefined ? null : requestedMarkdownPathFor(requestPath, request.headers.accept);

        if (requestedMarkdownPath === null) {
          passToRouter();
          return;
        }

        // Read per request so an edit to a content file shows up without a restart.
        const markdownFilesByPath = new Map(
          markdownFilesFor(readAuthoredContent(), {
            includeDrafts: true,
            renderMarkdown: renderEntryMarkdown,
            readEntryDataModule: readEntryDataModuleInDev,
          }).map((markdownFile) => [markdownFile.path, markdownFile]),
        );
        const markdownFile = markdownFilesByPath.get(requestedMarkdownPath);

        if (!markdownFile) {
          passToRouter();
          return;
        }

        // The document's path is served as both HTML and Markdown, so a shared cache has to key on
        // `Accept`. Appended rather than set, to keep the `Vary` the dev server adds for `Origin`.
        if (requestedMarkdownPath !== requestPath) {
          response.appendHeader("vary", "Accept");
        }

        markdownFile
          .render()
          .then((markdown) => {
            response.setHeader("content-type", MARKDOWN_CONTENT_TYPE);
            response.setHeader("content-signal", CONTENT_SIGNAL); // As `declaringContentSignal` in `/src/worker.ts` sets it.
            response.setHeader("link", LLMS_TXT_LINK_HEADER);
            response.setHeader(MARKDOWN_TOKEN_COUNT_HEADER, String(estimatedTokenCountIn(markdown)));
            response.end(markdown);
          })
          .catch(next);
      });
    },
  };

  return [
    markdownEmitPlugin,
    markdownTokenCountsPlugin(async () => (await ensureRenderedMarkdown()).tokenCounts),
    llmsTxtPlugin({
      loadForBuild: async () => llmsTxtOf(await ensureRenderedMarkdown()),
      loadForDevRequest: async (server) => llmsTxtOf(await renderMarkdown(entryDataModuleReaderThrough(server))),
      addHeadersRules,
    }),
  ];
}
