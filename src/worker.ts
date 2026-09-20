import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { MARKDOWN_TOKEN_COUNTS } from "virtual:markdown-token-counts";

import { HTML_MEDIA_TYPE, MARKDOWN_CONTENT_TYPE, MARKDOWN_MEDIA_TYPE } from "#/config/media-types.ts";
import { CONTENT_SIGNAL } from "#/config/site.ts";
import { ASSETS_BINDING } from "#/server/bindings.ts";
import {
  MARKDOWN_TOKEN_COUNT_HEADER,
  isMarkdownPath,
  markdownRepresentationPathFor,
  prefersMarkdown,
} from "#/site/markdown-negotiation.ts";

import type { AssetsBinding, WorkerEntry, WorkerEnv } from "cloudflare:workers";

const startFetch = createStartHandler(defaultStreamHandler);

const fetchAssetAt = (assets: AssetsBinding, request: Request, path: string) =>
  assets.fetch(new Request(new URL(path, request.url), request));

// Treat `304 Not Modified` as a file response, not a miss. Otherwise, a conditional request for
// Markdown could receive the rendered document instead of confirming its cached Markdown file.
const isFileResponse = (file: Response) => file.ok || file.status === 304;

function asMarkdownResponse(file: Response, path: string): Response {
  if (file.status === 304) {
    return file;
  }

  const headers = new Headers(file.headers);
  const tokenCount = MARKDOWN_TOKEN_COUNTS[path];

  headers.set("content-type", MARKDOWN_CONTENT_TYPE);

  if (tokenCount !== undefined && file.status === 200) {
    headers.set(MARKDOWN_TOKEN_COUNT_HEADER, String(tokenCount));
  }

  return new Response(file.body, { status: file.status, headers });
}

// Adds `Vary: Accept` so shared caches distinguish response representations.
function varyingOnAccept(response: Response): Response {
  const responseVaryingOnAccept = new Response(response.body, response);

  responseVaryingOnAccept.headers.append("vary", "Accept");

  return responseVaryingOnAccept;
}

function asHtmlRequest(request: Request): Request {
  const headers = new Headers(request.headers);

  headers.set("accept", HTML_MEDIA_TYPE);

  return new Request(request, { headers });
}

async function fileOrRenderedDocument(file: Response, request: Request): Promise<Response> {
  if (file.status !== 404) {
    return file;
  }

  const acceptHeader = request.headers.get("accept");

  return await startFetch(prefersMarkdown(acceptHeader) ? asHtmlRequest(request) : request);
}

function declaringContentSignal(response: Response): Response {
  const mediaType = response.headers.get("content-type") ?? "";

  if (![HTML_MEDIA_TYPE, MARKDOWN_MEDIA_TYPE].some((contentMediaType) => mediaType.startsWith(contentMediaType))) {
    return response;
  }

  const responseDeclaringContentSignal = new Response(response.body, response);

  responseDeclaringContentSignal.headers.set("content-signal", CONTENT_SIGNAL);

  return responseDeclaringContentSignal;
}

async function respondTo(request: Request, env?: WorkerEnv): Promise<Response> {
  const assets = env?.[ASSETS_BINDING];

  if (!assets || !["GET", "HEAD"].includes(request.method)) {
    return await startFetch(request);
  }

  const { pathname } = new URL(request.url);

  if (isMarkdownPath(pathname)) {
    const markdown = await fetchAssetAt(assets, request, pathname);
    return isFileResponse(markdown)
      ? asMarkdownResponse(markdown, pathname)
      : await fileOrRenderedDocument(markdown, request);
  }

  const markdownRepresentationPath = markdownRepresentationPathFor(pathname);

  if (markdownRepresentationPath === null || MARKDOWN_TOKEN_COUNTS[markdownRepresentationPath] === undefined) {
    return await fileOrRenderedDocument(await assets.fetch(request), request);
  }

  if (prefersMarkdown(request.headers.get("accept"))) {
    const markdown = await fetchAssetAt(assets, request, markdownRepresentationPath);

    if (isFileResponse(markdown)) {
      return varyingOnAccept(asMarkdownResponse(markdown, markdownRepresentationPath));
    }
  }

  return varyingOnAccept(await fileOrRenderedDocument(await assets.fetch(request), request));
}

const worker: WorkerEntry = {
  fetch: async (request, env) => declaringContentSignal(await respondTo(request, env)),
};

export default worker;
