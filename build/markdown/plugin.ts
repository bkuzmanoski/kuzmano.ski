import { HTML_MEDIA_TYPE, MARKDOWN_CONTENT_TYPE } from "#/config/media-types.ts";
import {
  MARKDOWN_TOKEN_COUNT_HEADER,
  isMarkdownPath,
  markdownRepresentationPathFor,
  prefersMarkdown,
} from "#/site/markdown-negotiation.ts";

import { readAuthoredContent } from "../content/authored-content.ts";
import { NO_MEDIA_FOR_ENTRY } from "../content/markup/media-rewrite.ts";
import { CLIENT_ENVIRONMENT } from "../environments.ts";
import { requestPathOf } from "../paths.ts";

import { markdownFilesFor, renderedMarkdownFilesFor } from "./markdown-files.ts";
import { markdownTokenCountsPlugin } from "./markdown-token-counts.ts";
import { estimatedTokenCountIn, estimatedTokenCountsOf } from "./token-count.ts";

import type { MediaForEntry } from "../content/markup/media-rewrite.ts";
import type { Plugin } from "vite";

/**
 * Emits Markdown representations for every route, exposes estimated token counts for Markdown files through
 * `virtual:markdown-token-counts`, and discards the shared render once every environment has finished building.
 */
export function markdownPlugin({
  mediaForEntry = NO_MEDIA_FOR_ENTRY,
}: { mediaForEntry?: MediaForEntry } = {}): Array<Plugin> {
  let renderedFiles: Promise<Map<string, string>> | null = null;

  // Whichever environment builds first renders the content; the other awaits the same render.
  // Only the two build-time hooks below reach this, so nothing is rendered under `vite dev`.
  const ensureRenderedFiles = () =>
    (renderedFiles ??= renderedMarkdownFilesFor(readAuthoredContent(), { mediaForEntry }).catch((cause: unknown) => {
      renderedFiles = null; // Clear a failed render so a rebuild under `--watch` retries after the content is fixed.
      throw cause;
    }));

  const markdownEmitPlugin: Plugin = {
    name: "kuzmano.ski:markdown-emit",
    applyToEnvironment: (environment) => environment.name === CLIENT_ENVIRONMENT,
    async generateBundle() {
      for (const [path, markdown] of await ensureRenderedFiles()) {
        this.emitFile({ type: "asset", fileName: path.slice(1), source: markdown });
      }
    },
    configureServer(server) {
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

        const respondWithMarkdown = (render: () => Promise<string>) => {
          render()
            .then((markdown) => {
              response.setHeader("content-type", MARKDOWN_CONTENT_TYPE);
              response.setHeader(MARKDOWN_TOKEN_COUNT_HEADER, String(estimatedTokenCountIn(markdown)));
              response.end(markdown);
            })
            .catch(next);
        };

        const requestPath = requestPathOf(request);

        if (requestPath === undefined) {
          passToRouter();
          return;
        }

        // Re-read per request so an edit to a content file shows up without a restart.
        const markdownFiles = markdownFilesFor(readAuthoredContent(), { includeDrafts: true, mediaForEntry });
        const markdownFileAt = (path: string | null) =>
          path === null ? undefined : markdownFiles.find((candidate) => candidate.path === path);

        if (isMarkdownPath(requestPath)) {
          const namedFile = markdownFileAt(requestPath);

          if (namedFile) {
            respondWithMarkdown(namedFile.render);
            return;
          }

          passToRouter();
          return;
        }

        const representationFile = markdownFileAt(markdownRepresentationPathFor(requestPath));

        if (!representationFile) {
          passToRouter();
          return;
        }

        // The path answers in both HTML and Markdown, so a shared cache has to key on `Accept`.
        // Appended rather than set, to keep the `Vary` the dev server adds for `Origin`.
        response.appendHeader("vary", "Accept");

        if (prefersMarkdown(request.headers.accept)) {
          respondWithMarkdown(representationFile.render);
          return;
        }

        passToRouter();
      });
    },
  };

  // Clears the memoized render once every environment has finished building, so a rebuild under
  // `--watch` renders the content again instead of emitting what the previous build produced.
  const markdownReleasePlugin: Plugin = {
    name: "kuzmano.ski:markdown-release",
    buildApp: {
      order: "post",
      // eslint-disable-next-line @typescript-eslint/require-await -- The hook is typed as asynchronous.
      handler: async () => {
        renderedFiles = null;
      },
    },
  };

  return [
    markdownEmitPlugin,
    markdownTokenCountsPlugin(async () => estimatedTokenCountsOf(await ensureRenderedFiles())),
    markdownReleasePlugin,
  ];
}
