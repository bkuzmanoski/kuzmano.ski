import { describe, expect, test, vi } from "vitest";

import { MARKDOWN_CONTENT_TYPE } from "#/config/media-types.ts";
import { CONTENT_SIGNAL } from "#/config/site.ts";
import { MARKDOWN_TOKEN_COUNT_HEADER } from "#/site/markdown-negotiation.ts";
import { LLMS_TXT_LINK_HEADER } from "#/site/metadata.ts";

import { readAuthoredContent } from "../content/authored-content.ts";
import { devServerMiddlewareOf, devServerRequestFor } from "../test-utils/dev-server.ts";

import { entryDataModuleReaderThrough, readEntryDataModule } from "./entry-data.ts";
import { markdownFilesFor, renderedMarkdownFilesFor } from "./markdown-files.ts";
import { RESOLVED_MARKDOWN_TOKEN_COUNTS_MODULE_ID } from "./markdown-token-counts.ts";
import { markdownPlugin } from "./plugin.ts";
import { estimatedTokenCountIn } from "./token-count.ts";

import type * as entryDataModule from "./entry-data.ts";
import type * as authoredContentModule from "../content/authored-content.ts";
import type { Plugin } from "vite";

const PAGE_MARKDOWN = "# A title\n\nA Markdown representation.\n";
const COLLECTION_MARKDOWN = "# Collection\n";

const { renders, readEntryDataModuleInDev } = vi.hoisted(() => ({
  renders: { count: 0 },
  readEntryDataModuleInDev: () => Promise.resolve({}),
}));

vi.mock("../content/authored-content.ts", async (importOriginal) => {
  const { authoredContent } = await import("../test-utils/authored-content.ts");
  return {
    ...(await importOriginal<typeof authoredContentModule>()),
    readAuthoredContent: vi.fn(() => authoredContent()),
  };
});
vi.mock("./entry-data.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof entryDataModule>()),
  entryDataModuleReaderThrough: vi.fn(() => readEntryDataModuleInDev),
}));
vi.mock("./markdown-files.ts", () => ({
  markdownFilesFor: vi.fn(() => [
    { path: "/page.md", render: () => Promise.resolve(PAGE_MARKDOWN) },
    { path: "/collection.md", render: () => Promise.resolve(COLLECTION_MARKDOWN) },
  ]),
  renderedMarkdownFilesFor: vi.fn(() => Promise.resolve(new Map([["/page.md", `Render ${++renders.count}\n`]]))), // Counts each render, so a test can tell a new render from a memoized one.
}));

const DEV_SERVER = { environments: {} };

const pluginNamed = (plugins: Array<Plugin>, name: string) => {
  const plugin = plugins.find((candidate) => candidate.name === name);

  if (!plugin) {
    throw new Error(`The Markdown plugin does not include \`${name}\`.`);
  }

  return plugin;
};

const devServerPlugins = markdownPlugin({ addHeadersRules: () => undefined });
const middleware = devServerMiddlewareOf(pluginNamed(devServerPlugins, "kuzmano.ski:markdown-emit"), DEV_SERVER);

const requestFor = (url: string, acceptHeader?: string, presetVary?: string) =>
  devServerRequestFor(middleware, url, {
    requestHeaders: acceptHeader === undefined ? {} : { accept: acceptHeader },
    responseHeaders: presetVary === undefined ? {} : { vary: presetVary },
  });

describe("serving a request that prefers Markdown", () => {
  test("returns the Markdown representation of the page named by its path", async () => {
    const { body, responseHeaders: headers } = await requestFor("/page", "text/markdown");

    expect(headers["content-type"]).toBe(MARKDOWN_CONTENT_TYPE);
    expect(body).toBe(PAGE_MARKDOWN);
  });

  test("includes the estimated token count of the Markdown it rendered", async () => {
    const { responseHeaders: headers } = await requestFor("/page", "text/markdown");
    expect(headers[MARKDOWN_TOKEN_COUNT_HEADER]).toBe(String(estimatedTokenCountIn(PAGE_MARKDOWN)));
  });

  test("sets the `Vary` header to `Accept`", async () => {
    const { responseHeaders: headers } = await requestFor("/page", "text/markdown");
    expect(headers.vary).toBe("Accept");
  });

  test("appends `Accept` to the `Vary` header the dev server has already set", async () => {
    const { responseHeaders: headers } = await requestFor("/page", "text/markdown", "Origin");
    expect(headers.vary).toBe("Origin, Accept");
  });

  test("sets the `Content-Signal` header to the site's content signal", async () => {
    const { responseHeaders: headers } = await requestFor("/page", "text/markdown");
    expect(headers["content-signal"]).toBe(CONTENT_SIGNAL);
  });

  test("sets the `Link` header to the `llms.txt` index", async () => {
    const { responseHeaders: headers } = await requestFor("/page", "text/markdown");
    expect(headers.link).toBe(LLMS_TXT_LINK_HEADER);
  });

  test("passes a request for a path without a Markdown representation to the router, as a request for HTML", async () => {
    const { isPassedOn, requestHeaders } = await requestFor("/feature", "text/markdown");

    expect(isPassedOn).toBe(true);
    expect(requestHeaders.accept).toBe("text/html");
  });
});

describe("serving a request that does not prefer Markdown", () => {
  test("passes the request to the router with the `Accept` header it was sent", async () => {
    const { isPassedOn, requestHeaders } = await requestFor("/page", "text/html");

    expect(isPassedOn).toBe(true);
    expect(requestHeaders.accept).toBe("text/html");
  });

  test.each([
    ["a document", "/page", "text/html"],
    ["a module", "/@vite/client", "*/*"],
    ["an asset", "/assets/image.png", "text/markdown"],
  ])("passes a request for %s to the router without reading the content", async (_label, url, acceptHeader) => {
    vi.mocked(readAuthoredContent).mockClear();

    const { isPassedOn } = await requestFor(url, acceptHeader);

    expect(isPassedOn).toBe(true);
    expect(readAuthoredContent).not.toHaveBeenCalled();
  });
});

describe("serving a request for a Markdown file by name", () => {
  test("returns the file with a Markdown content type", async () => {
    const { body, responseHeaders: headers } = await requestFor("/collection.md");

    expect(headers["content-type"]).toBe(MARKDOWN_CONTENT_TYPE);
    expect(body).toBe(COLLECTION_MARKDOWN);
  });

  test("does not set the `Vary` header", async () => {
    const { responseHeaders: headers } = await requestFor("/collection.md");
    expect(headers.vary).toBeUndefined();
  });

  test("passes a request for a file that does not exist to the router", async () => {
    const { isPassedOn } = await requestFor("/missing.md", "text/markdown");
    expect(isPassedOn).toBe(true);
  });
});

test("ignores the query when matching a request path", async () => {
  const { body } = await requestFor("/page.md?query", "text/markdown");
  expect(body).toBe(PAGE_MARKDOWN);
});

describe("reading entry data", () => {
  test("renders a Markdown response with the reader of the dev server's module runner", async () => {
    vi.mocked(markdownFilesFor).mockClear();

    await requestFor("/page", "text/markdown");

    expect(entryDataModuleReaderThrough).toHaveBeenCalledWith(expect.objectContaining(DEV_SERVER));
    expect(markdownFilesFor).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ readEntryDataModule: readEntryDataModuleInDev }),
    );
  });

  test("renders `llms.txt` under `vite dev` with the reader of the dev server's module runner", async () => {
    const llmsTxtMiddleware = devServerMiddlewareOf(pluginNamed(devServerPlugins, "kuzmano.ski:llms-txt"), DEV_SERVER);
    vi.mocked(renderedMarkdownFilesFor).mockClear();

    await devServerRequestFor(llmsTxtMiddleware, "/llms.txt");

    expect(renderedMarkdownFilesFor).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ readEntryDataModule: readEntryDataModuleInDev }),
    );
  });

  test("renders the Markdown files of a build with `readEntryDataModule`", async () => {
    const plugins = markdownPlugin({ addHeadersRules: () => undefined });
    const generateBundle = pluginNamed(plugins, "kuzmano.ski:markdown-emit").generateBundle as (
      this: unknown,
    ) => Promise<void>;
    vi.mocked(renderedMarkdownFilesFor).mockClear();

    await generateBundle.call({ emitFile: () => undefined });

    expect(renderedMarkdownFilesFor).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ readEntryDataModule }),
    );
  });
});

describe("building", () => {
  async function emittedPageMarkdownOf(plugins: Array<Plugin>): Promise<unknown> {
    const emittedSources = new Map<string, unknown>();
    const generateBundle = pluginNamed(plugins, "kuzmano.ski:markdown-emit").generateBundle as () => Promise<void>;

    await generateBundle.call({
      emitFile: ({ fileName, source }: { fileName: string; source: unknown }) =>
        void emittedSources.set(fileName, source),
    });

    return emittedSources.get("page.md");
  }

  test("emits the Markdown files and serves the token counts from one render", async () => {
    const plugins = markdownPlugin({ addHeadersRules: () => undefined });
    const loadTokenCounts = pluginNamed(plugins, "kuzmano.ski:markdown-token-counts").load as (
      this: unknown,
      id: string,
    ) => Promise<string>;
    const rendersBefore = renders.count;
    const pageMarkdown = await emittedPageMarkdownOf(plugins);
    const tokenCountsModule = await loadTokenCounts.call(
      { environment: { config: { command: "build" } }, addWatchFile: () => undefined },
      RESOLVED_MARKDOWN_TOKEN_COUNTS_MODULE_ID,
    );

    expect(renders.count).toBe(rendersBefore + 1);
    expect(tokenCountsModule).toBe(
      `export const MARKDOWN_TOKEN_COUNTS = ${JSON.stringify({ "/page.md": estimatedTokenCountIn(String(pageMarkdown)) })};`,
    );
  });
});
