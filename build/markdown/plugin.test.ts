import { describe, expect, test, vi } from "vitest";

import { MARKDOWN_CONTENT_TYPE } from "#/config/media-types.ts";
import { MARKDOWN_TOKEN_COUNT_HEADER } from "#/site/markdown-negotiation.ts";

import { markdownPlugin } from "./plugin.ts";
import { estimatedTokenCountIn } from "./token-count.ts";

import type { Connect, Plugin, ViteDevServer } from "vite";

const PAGE_MARKDOWN = "# A title\n\nA Markdown representation.\n";
const COLLECTION_MARKDOWN = "# Collection\n";

vi.mock("../content/authored-content.ts", () => ({ readAuthoredContent: () => ({ pages: [], collections: [] }) }));
vi.mock("./markdown-files.ts", () => ({
  markdownFilesFor: () => [
    { path: "/page.md", render: () => Promise.resolve(PAGE_MARKDOWN) },
    { path: "/collection.md", render: () => Promise.resolve(COLLECTION_MARKDOWN) },
  ],
  renderedMarkdownFilesFor: () => Promise.resolve(new Map()),
}));

function middlewareOf(plugins: Array<Plugin>): Connect.NextHandleFunction {
  const configureServer = plugins.find(({ name }) => name === "kuzmano.ski:markdown-emit")?.configureServer;

  if (typeof configureServer !== "function") {
    throw new Error("The Markdown plugin does not register a dev server middleware.");
  }

  let middleware: Connect.NextHandleFunction | undefined;

  void configureServer.call(
    {} as never,
    {
      middlewares: { use: (handler: Connect.NextHandleFunction) => void (middleware = handler) },
    } as unknown as ViteDevServer,
  );

  if (!middleware) {
    throw new Error("The Markdown plugin did not register a dev server middleware.");
  }

  return middleware;
}

const middleware = middlewareOf(markdownPlugin());

interface Exchange {
  headers: Record<string, string>;
  body: string | undefined;
  passedToRouter: boolean;
  routerAcceptHeader: string | undefined;
}

async function requestFor(url: string, acceptHeader?: string, presetVary?: string): Promise<Exchange> {
  const headers: Record<string, string> = acceptHeader === undefined ? {} : { accept: acceptHeader };
  const request = { url, headers };
  const exchange: Exchange = {
    headers: presetVary === undefined ? {} : { vary: presetVary },
    body: undefined,
    passedToRouter: false,
    routerAcceptHeader: undefined,
  };

  await new Promise<void>((resolve, reject) => {
    const response = {
      setHeader: (name: string, value: string) => void (exchange.headers[name.toLowerCase()] = value),
      appendHeader: (name: string, value: string) => {
        const existing = exchange.headers[name.toLowerCase()];
        exchange.headers[name.toLowerCase()] = existing === undefined ? value : `${existing}, ${value}`;
      },
      end: (body: string) => {
        exchange.body = body;
        resolve();
      },
    };
    const next = (cause?: unknown) => {
      if (cause) {
        reject(cause instanceof Error ? cause : new Error("The middleware reported a failure."));
        return;
      }

      exchange.passedToRouter = true;
      exchange.routerAcceptHeader = headers.accept;

      resolve();
    };

    middleware(request as never, response as never, next);
  });

  return exchange;
}

describe("serving a request that prefers Markdown", () => {
  test("returns the Markdown representation of the page named by its path", async () => {
    const { body, headers } = await requestFor("/page", "text/markdown");

    expect(headers["content-type"]).toBe(MARKDOWN_CONTENT_TYPE);
    expect(body).toBe(PAGE_MARKDOWN);
  });

  test("includes the estimated token count of the Markdown it rendered", async () => {
    const { headers } = await requestFor("/page", "text/markdown");
    expect(headers[MARKDOWN_TOKEN_COUNT_HEADER]).toBe(String(estimatedTokenCountIn(PAGE_MARKDOWN)));
  });

  test("sets the `Vary` header to `Accept`", async () => {
    const { headers } = await requestFor("/page", "text/markdown");
    expect(headers.vary).toBe("Accept");
  });

  test("passes a request for a path without a Markdown representation to the router, as a request for HTML", async () => {
    const { passedToRouter, routerAcceptHeader } = await requestFor("/feature", "text/markdown");

    expect(passedToRouter).toBe(true);
    expect(routerAcceptHeader).toBe("text/html");
  });
});

describe("serving a request that does not prefer Markdown", () => {
  test("passes the request to the router with the `Accept` header it was sent", async () => {
    const { passedToRouter, routerAcceptHeader } = await requestFor("/page", "text/html");

    expect(passedToRouter).toBe(true);
    expect(routerAcceptHeader).toBe("text/html");
  });

  test("sets the `Vary` header to `Accept` on a document that has a Markdown representation", async () => {
    const { headers } = await requestFor("/page", "text/html");
    expect(headers.vary).toBe("Accept");
  });

  test("does not set the `Vary` header on a path without a Markdown representation", async () => {
    const { headers } = await requestFor("/feature", "text/html");
    expect(headers.vary).toBeUndefined();
  });

  test("appends `Accept` to the `Vary` header the dev server has already set", async () => {
    const { headers } = await requestFor("/page", "text/html", "Origin");
    expect(headers.vary).toBe("Origin, Accept");
  });
});

describe("serving a request for a Markdown file by name", () => {
  test("returns the file with a Markdown content type", async () => {
    const { body, headers } = await requestFor("/collection.md");

    expect(headers["content-type"]).toBe(MARKDOWN_CONTENT_TYPE);
    expect(body).toBe(COLLECTION_MARKDOWN);
  });

  test("does not set the `Vary` header", async () => {
    const { headers } = await requestFor("/collection.md");
    expect(headers.vary).toBeUndefined();
  });

  test("passes a request for a file that does not exist to the router", async () => {
    const { passedToRouter } = await requestFor("/missing.md", "text/markdown");
    expect(passedToRouter).toBe(true);
  });
});

test("ignores the query when matching a request path", async () => {
  const { body } = await requestFor("/page.md?query", "text/markdown");
  expect(body).toBe(PAGE_MARKDOWN);
});
