import { describe, expect, test, vi } from "vitest";

import { PAGES_DIRECTORY_NAME } from "#/config/content.ts";
import type * as contentConfig from "#/config/content.ts";
import { PLAIN_TEXT_CONTENT_TYPE } from "#/config/media-types.ts";
import { CONTENT_SIGNAL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "#/config/site.ts";

import { CLIENT_ENVIRONMENT } from "../environments.ts";
import {
  authoredCollection,
  authoredContent,
  authoredContentDirectory,
  authoredEntry,
  draftEntry,
} from "../test-utils/authored-content.ts";
import { devServerMiddlewareOf, devServerRequestFor } from "../test-utils/dev-server.ts";
import { headersRulesAddedAtBuildStartBy } from "../test-utils/headers.ts";
import { linkTextsIn } from "../test-utils/markdown.ts";

import { llmsTxtFor, llmsTxtPlugin } from "./llms-txt.ts";

import type { MarkdownTokenCounts } from "./token-count.ts";
import type { AddHeadersRules } from "../headers.ts";

vi.mock("#/config/content.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof contentConfig>()),
  PAGE_SLUGS: ["page-2", "page-1", "draft-page"],
  COLLECTIONS: {
    collection: { title: "Collection", description: "" },
    empty: { title: "Empty", description: "" },
  },
}));

const TOKEN_COUNTS: MarkdownTokenCounts = {
  "/page-1.md": 607,
  "/page-2.md": 302,
  "/collection/older-entry.md": 145,
  "/collection/newer-entry.md": 98,
};

const content = authoredContent({
  pages: authoredContentDirectory(PAGES_DIRECTORY_NAME, [
    authoredEntry("page-1"),
    authoredEntry("page-2"),
    authoredEntry("undeclared"),
    draftEntry("draft-page"),
  ]),
  collections: [
    authoredCollection("collection", [
      authoredEntry("older-entry", { date: "2026-01-02" }),
      authoredEntry("newer-entry", { date: "2026-03-04" }),
      draftEntry("draft-entry"),
    ]),
    authoredCollection("empty", [draftEntry("unpublished-entry")]),
  ],
});

const headingsOf = (text: string) => text.split("\n").filter((line) => line.startsWith("## "));

const BUILD_LLMS_TXT = `# Built
`;
const DEV_LLMS_TXT = `# Served
`;

function pluginWithLoaders({ addHeadersRules = () => undefined }: { addHeadersRules?: AddHeadersRules } = {}) {
  const loadForBuild = vi.fn(() => Promise.resolve(BUILD_LLMS_TXT));
  const loadForDevRequest = vi.fn(() => Promise.resolve(DEV_LLMS_TXT));
  return {
    plugin: llmsTxtPlugin({ loadForBuild, loadForDevRequest, addHeadersRules }),
    loadForBuild,
    loadForDevRequest,
  };
}

describe("llmsTxtFor", () => {
  const llmsTxt = llmsTxtFor(content, TOKEN_COUNTS);

  test("opens with the site's name as the only H1", () => {
    // The specification allows one H1, so a second heading at that level would invalidate the file.
    expect(llmsTxt.split("\n").filter((line) => line.startsWith("# "))).toStrictEqual([`# ${SITE_NAME}`]);
  });

  test("summarizes the site in the blockquote below the H1", () => {
    expect(llmsTxt).toContain(`# ${SITE_NAME}

> ${SITE_DESCRIPTION}
`);
  });

  test("describes both ways to request Markdown above the first section", () => {
    const preamble = llmsTxt.slice(0, llmsTxt.indexOf("## "));

    expect(preamble).toContain("append `.md` to a path");
    expect(preamble).toContain("send `Accept: text/markdown`");
  });

  test("links each document's Markdown representation, not the document itself", () => {
    expect(llmsTxt).toContain(`[page-1](${SITE_URL}/page-1.md)`);
    expect(llmsTxt).not.toContain(`[page-1](${SITE_URL}/page-1)`);
  });

  test("annotates a link with the entry's description and an estimate of the tokens reading it costs", () => {
    expect(llmsTxt).toContain(`[page-1](${SITE_URL}/page-1.md): About page-1. (~607 tokens)`);
  });

  test("throws when a listed entry has no token count, naming its path", () => {
    const { "/collection/newer-entry.md": _omittedTokenCount, ...incompleteTokenCounts } = TOKEN_COUNTS;
    expect(() => llmsTxtFor(content, incompleteTokenCounts)).toThrow('"/collection/newer-entry.md"');
  });

  test("writes a title containing Markdown syntax as the literal text of its link", () => {
    const title = "A *title* with _emphasis_, `code`, <html>, and [brackets]";
    const contentWithMarkdownSyntaxTitle = authoredContent({
      pages: authoredContentDirectory(PAGES_DIRECTORY_NAME, [
        authoredEntry("page-1", { frontmatter: { title, description: "A description.", date: "2026-07-19" } }),
      ]),
    });

    expect(linkTextsIn(llmsTxtFor(contentWithMarkdownSyntaxTitle, TOKEN_COUNTS))).toContain(title);
  });

  test("collapses a description written over several lines onto the line of its list item", () => {
    const multiLineContent = authoredContent({
      pages: authoredContentDirectory(PAGES_DIRECTORY_NAME, [
        authoredEntry("page-1", {
          frontmatter: {
            title: "page-1",
            description: `The first line
              and the second line.`,
            date: "2026-07-19",
          },
        }),
      ]),
    });

    expect(llmsTxtFor(multiLineContent, TOKEN_COUNTS)).toContain(
      `[page-1](${SITE_URL}/page-1.md): The first line and the second line. (~607 tokens)`,
    );
  });

  test("orders the H2 sections as the pages, each listed collection, and then the `Optional` links", () => {
    expect(headingsOf(llmsTxt)).toStrictEqual(["## Pages", "## Collection", "## Optional"]);
  });

  test("lists the pages in the order `PAGE_SLUGS` declares them", () => {
    expect(llmsTxt.indexOf("/page-2.md")).toBeLessThan(llmsTxt.indexOf("/page-1.md"));
  });

  test("lists a collection's published entries under its title, newest first", () => {
    const collection = llmsTxt.slice(llmsTxt.indexOf("## Collection"), llmsTxt.indexOf("## Optional"));

    expect(collection).toContain(
      `[older-entry](${SITE_URL}/collection/older-entry.md): About older-entry. (~145 tokens)`,
    );
    expect(collection.indexOf("/newer-entry.md")).toBeLessThan(collection.indexOf("/older-entry.md"));
  });

  test("omits a collection without published entries from the sections", () => {
    expect(llmsTxt).not.toContain("## Empty");
  });

  test.each([
    ["a draft page", "/draft-page"],
    ["a draft collection entry", "/collection/draft-entry"],
    ["a page that is not declared in `PAGE_SLUGS`", "/undeclared"],
  ])("omits %s", (_label, route) => {
    expect(llmsTxt).not.toContain(`(${SITE_URL}${route}.md)`);
  });

  test("lists the Atom feed under the reserved `Optional` heading", () => {
    const optional = llmsTxt.slice(llmsTxt.indexOf("## Optional"));
    expect(optional).toContain(`[Atom feed](${SITE_URL}/feed.xml)`);
  });

  test("ends with a single trailing newline", () => {
    expect(llmsTxt.endsWith("\n")).toBe(true);
    expect(llmsTxt.endsWith("\n\n")).toBe(false);
  });
});

describe("llmsTxtPlugin", () => {
  test("emits `llms.txt` into the client build from the build's render", async () => {
    const { plugin, loadForDevRequest } = pluginWithLoaders();
    const emitFile = vi.fn();

    await (plugin.generateBundle as (this: unknown) => Promise<void>).call({ emitFile });

    expect(emitFile).toHaveBeenCalledWith({ type: "asset", fileName: "llms.txt", source: BUILD_LLMS_TXT });
    expect(loadForDevRequest).not.toHaveBeenCalled();
  });

  test("adds a `Content-Signal` rule for `/llms.txt` to `_headers` when the build starts", () => {
    expect(
      headersRulesAddedAtBuildStartBy((options) => pluginWithLoaders(options).plugin, CLIENT_ENVIRONMENT),
    ).toStrictEqual([
      expect.objectContaining({ pathPatterns: ["/llms.txt"], headers: { "Content-Signal": CONTENT_SIGNAL } }),
    ]);
  });

  test("serves `/llms.txt` under `vite dev` as plain text, rendered again for each request", async () => {
    const { plugin, loadForBuild, loadForDevRequest } = pluginWithLoaders();
    const middleware = devServerMiddlewareOf(plugin);
    const { responseHeaders, body } = await devServerRequestFor(middleware, "/llms.txt");

    await devServerRequestFor(middleware, "/llms.txt?query");

    expect(responseHeaders["content-type"]).toBe(PLAIN_TEXT_CONTENT_TYPE);
    expect(body).toBe(DEV_LLMS_TXT);
    expect(loadForDevRequest).toHaveBeenCalledTimes(2);
    expect(loadForBuild).not.toHaveBeenCalled();
  });

  test("passes a request for another path to the next middleware", async () => {
    const { plugin, loadForDevRequest } = pluginWithLoaders();
    const { isPassedOn } = await devServerRequestFor(devServerMiddlewareOf(plugin), "/page-1.md");

    expect(isPassedOn).toBe(true);
    expect(loadForDevRequest).not.toHaveBeenCalled();
  });
});
