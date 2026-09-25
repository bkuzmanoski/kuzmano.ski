import { beforeEach, describe, expect, test, vi } from "vitest";

import { MARKDOWN_CONTENT_TYPE } from "#/config/media-types.ts";
import { CONTENT_SIGNAL } from "#/config/site.ts";
import { MARKDOWN_TOKEN_COUNT_HEADER } from "#/site/markdown-negotiation.ts";
import { LLMS_TXT_LINK_HEADER } from "#/site/metadata.ts";

import type { AssetsBinding, WorkerEnv } from "cloudflare:workers";

const RENDERED_DOCUMENT = "<!DOCTYPE html><title>Rendered</title>";
const RENDERED_ACCEPT_HEADER = "x-rendered-accept"; // Reports the `Accept` header the router was given.
const PAGE_TOKEN_COUNT = 607;
const COLLECTION_TOKEN_COUNT = 145;
const STALE_TOKEN_COUNT = 42;

// The build writes a count for each Markdown file it emits, so the paths in this map are also
// the documents that have a Markdown representation (see `/build/markdown/plugin.ts`).
vi.mock("virtual:markdown-token-counts", () => ({
  MARKDOWN_TOKEN_COUNTS: {
    "/page.md": PAGE_TOKEN_COUNT,
    "/collection.md": COLLECTION_TOKEN_COUNT,
    "/stale.md": STALE_TOKEN_COUNT,
  },
}));

// Mirror the production handler's HTML-only behavior and expose the received Accept header for assertions.
vi.mock("@tanstack/react-start/server", () => ({
  defaultStreamHandler: {},
  createStartHandler: () => (request: Request) => {
    const acceptHeader = request.headers.get("accept") ?? "";
    return acceptHeader.includes("text/html")
      ? new Response(RENDERED_DOCUMENT, {
          headers: { "content-type": "text/html; charset=utf-8", [RENDERED_ACCEPT_HEADER]: acceptHeader },
        })
      : Response.json(
          { error: "Only HTML requests are supported here" },
          { status: 500, headers: { [RENDERED_ACCEPT_HEADER]: acceptHeader } },
        );
  },
}));

const { default: worker } = await import("./worker.ts");

const ORIGIN = "https://example.com";
const DOCUMENT = "<!DOCTYPE html><title>A title</title>";
const PAGE_MARKDOWN = `# A title

A Markdown representation.
`;
const COLLECTION_MARKDOWN = `# Collection

- [A title](/collection/entry.md) (2026-07-19)
`;
const FILES: Record<string, { body: string; contentType: string } | undefined> = {
  "/page": { body: DOCUMENT, contentType: "text/html; charset=utf-8" },
  "/page.md": { body: PAGE_MARKDOWN, contentType: "text/markdown" },
  "/collection": { body: DOCUMENT, contentType: "text/html; charset=utf-8" },
  "/collection.md": { body: COLLECTION_MARKDOWN, contentType: "text/markdown" },
  "/collection/uncounted.md": { body: PAGE_MARKDOWN, contentType: "text/markdown" },
  "/feature": { body: DOCUMENT, contentType: "text/html; charset=utf-8" },
  "/stale": { body: DOCUMENT, contentType: "text/html; charset=utf-8" },
  "/media/image.webp": { body: "bytes", contentType: "image/webp" },
};
const PARTIAL_BODY_LENGTH = 8; // Bytes the Asset Worker returns for a `Range` request below.
const PARTIAL_RANGE = `bytes=0-${PARTIAL_BODY_LENGTH - 1}`;

const etagOf = (path: string) => `"${path}"`;

let requestedPaths: Array<string> = [];

// Mimics Asset Worker behavior: redirect trailing slashes and return `304` for matching ETags.
const assets: AssetsBinding = {
  fetch: (request) => {
    const { pathname } = new URL(request.url);
    const canonicalPath = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;

    requestedPaths.push(pathname);

    if (canonicalPath !== pathname) {
      return Promise.resolve(new Response(null, { status: 301, headers: { location: canonicalPath } }));
    }

    const file = FILES[pathname];

    if (!file) {
      return Promise.resolve(new Response(null, { status: 404 }));
    }

    if (request.headers.get("if-none-match") === etagOf(pathname)) {
      return Promise.resolve(new Response(null, { status: 304, headers: { etag: etagOf(pathname) } }));
    }

    if (request.headers.has("range")) {
      return Promise.resolve(
        new Response(file.body.slice(0, PARTIAL_BODY_LENGTH), {
          status: 206,
          headers: {
            "content-type": file.contentType,
            etag: etagOf(pathname),
            "content-range": `bytes 0-${PARTIAL_BODY_LENGTH - 1}/${file.body.length}`,
          },
        }),
      );
    }

    return Promise.resolve(
      new Response(file.body, { headers: { "content-type": file.contentType, etag: etagOf(pathname) } }),
    );
  },
};

const env = { ASSETS: assets } satisfies WorkerEnv;

const fetchPath = (
  path: string,
  {
    accept,
    method = "GET",
    ifNoneMatch,
    range,
  }: { accept?: string; method?: string; ifNoneMatch?: string; range?: string } = {},
) =>
  worker.fetch(
    new Request(`${ORIGIN}${path}`, {
      method,
      headers: {
        ...(accept === undefined ? {} : { accept }),
        ...(ifNoneMatch === undefined ? {} : { "if-none-match": ifNoneMatch }),
        ...(range === undefined ? {} : { range }),
      },
    }),
    env,
  );

beforeEach(() => {
  requestedPaths = [];
});

describe("handling a request that prefers Markdown", () => {
  test("returns the Markdown representation of the page named by its path", async () => {
    const response = await fetchPath("/page", { accept: "text/markdown" });

    expect(response.headers.get("content-type")).toBe(MARKDOWN_CONTENT_TYPE);
    await expect(response.text()).resolves.toBe(PAGE_MARKDOWN);
  });

  test("returns the Markdown representation of the collection named by its path", async () => {
    const response = await fetchPath("/collection", { accept: "text/markdown" });

    expect(response.headers.get("content-type")).toBe(MARKDOWN_CONTENT_TYPE);
    await expect(response.text()).resolves.toBe(COLLECTION_MARKDOWN);
  });

  test("includes the token count the build recorded for the Markdown", async () => {
    const response = await fetchPath("/page", { accept: "text/markdown" });
    expect(response.headers.get(MARKDOWN_TOKEN_COUNT_HEADER)).toBe(String(PAGE_TOKEN_COUNT));
  });

  test("includes the token count the build recorded when the request method is `HEAD`", async () => {
    const response = await fetchPath("/page", { accept: "text/markdown", method: "HEAD" });
    expect(response.headers.get(MARKDOWN_TOKEN_COUNT_HEADER)).toBe(String(PAGE_TOKEN_COUNT));
  });

  test("sets the `Link` header to the `llms.txt` index", async () => {
    const response = await fetchPath("/page", { accept: "text/markdown" });
    expect(response.headers.get("link")).toBe(LLMS_TXT_LINK_HEADER);
  });

  test("sets the `Vary` header to `Accept`", async () => {
    const response = await fetchPath("/page", { accept: "text/markdown" });
    expect(response.headers.get("vary")).toBe("Accept");
  });

  test("sets the `Vary` header to `Accept` on a partial response to a `Range` request", async () => {
    const response = await fetchPath("/page", { accept: "text/markdown", range: PARTIAL_RANGE });

    expect(response.status).toBe(206);
    expect(response.headers.get("vary")).toBe("Accept");
  });

  test("returns a 304 status code, and sets the `Vary` header to `Accept`, when the `If-None-Match` header matches the Markdown representation", async () => {
    const response = await fetchPath("/page", { accept: "text/markdown", ifNoneMatch: etagOf("/page.md") });

    expect(response.status).toBe(304);
    expect(response.headers.get("vary")).toBe("Accept");
  });

  test("reads only the Markdown representation when the `If-None-Match` header matches it", async () => {
    await fetchPath("/page", { accept: "text/markdown", ifNoneMatch: etagOf("/page.md") });
    expect(requestedPaths).toStrictEqual(["/page.md"]);
  });

  test("returns the HTML document when the build did not emit a Markdown representation for the path", async () => {
    const response = await fetchPath("/feature", { accept: "text/markdown" });

    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    await expect(response.text()).resolves.toBe(DOCUMENT);
  });

  test("does not set the `Vary` header when the build did not emit a Markdown representation for the path", async () => {
    const response = await fetchPath("/feature", { accept: "text/markdown" });
    expect(response.headers.get("vary")).toBeNull();
  });

  test("reads only the document when the build did not emit a Markdown representation for the path", async () => {
    await fetchPath("/feature", { accept: "text/markdown" });
    expect(requestedPaths).toStrictEqual(["/feature"]);
  });

  test("returns the HTML document, and sets the `Vary` header to `Accept`, when the build recorded a count for a Markdown file the Asset Worker does not have", async () => {
    const response = await fetchPath("/stale", { accept: "text/markdown" });

    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("vary")).toBe("Accept");
    await expect(response.text()).resolves.toBe(DOCUMENT);
  });

  test("redirects a path with a trailing slash to the path without one", async () => {
    const response = await fetchPath("/page/", { accept: "text/markdown" });

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("/page");
  });
});

describe("handling a request that does not prefer Markdown", () => {
  test("returns the HTML document", async () => {
    const response = await fetchPath("/page", { accept: "text/html,*/*;q=0.8" });

    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    await expect(response.text()).resolves.toBe(DOCUMENT);
  });

  test("does not read the Markdown representation", async () => {
    await fetchPath("/page");
    expect(requestedPaths).toStrictEqual(["/page"]);
  });

  test("sets the `Vary` header to `Accept`", async () => {
    const response = await fetchPath("/page");
    expect(response.headers.get("vary")).toBe("Accept");
  });

  test("returns a media file with its own content type, and does not set the `Vary` header", async () => {
    const response = await fetchPath("/media/image.webp");

    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("vary")).toBeNull();
  });
});

describe("handling a request for a Markdown file by name", () => {
  test("returns the file with a Markdown content type", async () => {
    const response = await fetchPath("/page.md");

    expect(response.headers.get("content-type")).toBe(MARKDOWN_CONTENT_TYPE);
    await expect(response.text()).resolves.toBe(PAGE_MARKDOWN);
  });

  test("includes the token count the build recorded for the file", async () => {
    const response = await fetchPath("/page.md");
    expect(response.headers.get(MARKDOWN_TOKEN_COUNT_HEADER)).toBe(String(PAGE_TOKEN_COUNT));
  });

  test("returns the file with a Markdown content type, and omits the token count, when the build did not record one", async () => {
    const response = await fetchPath("/collection/uncounted.md");

    expect(response.headers.get("content-type")).toBe(MARKDOWN_CONTENT_TYPE);
    expect(response.headers.get(MARKDOWN_TOKEN_COUNT_HEADER)).toBeNull();
  });

  test("returns a partial response with a Markdown content type, and omits the token count, for a `Range` request", async () => {
    const response = await fetchPath("/page.md", { range: PARTIAL_RANGE });

    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe(MARKDOWN_CONTENT_TYPE);
    expect(response.headers.get(MARKDOWN_TOKEN_COUNT_HEADER)).toBeNull();
    await expect(response.text()).resolves.toBe(PAGE_MARKDOWN.slice(0, PARTIAL_BODY_LENGTH));
  });

  test("does not set the `Vary` header", async () => {
    const response = await fetchPath("/page.md");
    expect(response.headers.get("vary")).toBeNull();
  });

  test("preserves the `ETag` sent by the Asset Worker", async () => {
    const response = await fetchPath("/page.md");
    expect(response.headers.get("etag")).toBe(etagOf("/page.md"));
  });

  test("returns a 304 status code when the `If-None-Match` header matches the file", async () => {
    const response = await fetchPath("/page.md", { ifNoneMatch: etagOf("/page.md") });
    expect(response.status).toBe(304);
  });
});

describe("handling a request the Asset Worker does not have a file for", () => {
  test.each([
    ["a path that does not exist", "/missing"],
    ["a Markdown file that does not exist", "/missing.md"],
  ])("renders the route for %s", async (_label, path) => {
    await expect(fetchPath(path, { accept: "text/html" }).then((response) => response.text())).resolves.toBe(
      RENDERED_DOCUMENT,
    );
  });

  test.each([
    ["a path that does not exist", "/missing"],
    ["a Markdown file that does not exist", "/missing.md"],
  ])("renders the route as HTML when a request for %s prefers Markdown", async (_label, path) => {
    const response = await fetchPath(path, { accept: "text/markdown" });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe(RENDERED_DOCUMENT);
  });

  test("forwards the request's `Accept` header when it does not prefer Markdown", async () => {
    const response = await fetchPath("/missing", { accept: "application/json, text/html" });
    expect(response.headers.get(RENDERED_ACCEPT_HEADER)).toBe("application/json, text/html");
  });

  test("does not set the `Vary` header", async () => {
    const response = await fetchPath("/missing", { accept: "application/json, text/html" });
    expect(response.headers.get("vary")).toBeNull();
  });
});

describe("bypassing the Asset Worker", () => {
  test.each(["GET", "HEAD"])(
    "renders the route for a %s request to an API path, with its `Accept` header unchanged",
    async (method) => {
      const response = await fetchPath("/api/endpoint", { accept: "application/json, text/html", method });

      expect(response.headers.get(RENDERED_ACCEPT_HEADER)).toBe("application/json, text/html");
      expect(requestedPaths).toStrictEqual([]);
    },
  );

  test("renders the route for a method it does not serve", async () => {
    const response = await fetchPath("/api/endpoint", { accept: "text/html", method: "POST" });

    await expect(response.text()).resolves.toBe(RENDERED_DOCUMENT);
    expect(requestedPaths).toStrictEqual([]);
  });

  test("renders the route when the Worker runs without an assets binding", async () => {
    const response = await worker.fetch(new Request(`${ORIGIN}/page`, { headers: { accept: "text/html" } }));

    await expect(response.text()).resolves.toBe(RENDERED_DOCUMENT);
    expect(requestedPaths).toStrictEqual([]);
  });
});

describe("the site's content signals", () => {
  test.each([
    ["a document", "/page", "text/html"],
    ["a Markdown representation", "/page", "text/markdown"],
    ["a Markdown file requested by name", "/page.md", undefined],
  ])("are declared on %s", async (_label, path, accept) => {
    const response = await fetchPath(path, accept === undefined ? {} : { accept });
    expect(response.headers.get("content-signal")).toBe(CONTENT_SIGNAL);
  });

  test.each([
    ["a path that does not exist", "/missing"],
    ["a Markdown file that does not exist", "/missing.md"],
  ])("are declared on the rendered document for %s", async (_label, path) => {
    const response = await fetchPath(path, { accept: "text/html" });
    expect(response.headers.get("content-signal")).toBe(CONTENT_SIGNAL);
  });

  test("are not declared on a media file", async () => {
    const response = await fetchPath("/media/image.webp");
    expect(response.headers.get("content-signal")).toBeNull();
  });

  test("are not declared on an API response", async () => {
    const response = await fetchPath("/api/endpoint", { accept: "application/json", method: "POST" });
    expect(response.headers.get("content-signal")).toBeNull();
  });
});
