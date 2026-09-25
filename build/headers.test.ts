import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  IMMUTABLE_CACHE_CONTROL,
  headersFile,
  headersFileTextFrom,
  headersMatchingPathIn,
  headersRuleText,
  matchableHeadersRuleFrom,
} from "./headers.ts";
import { devServerMiddlewareOf } from "./test-utils/dev-server.ts";

import type { HeadersRule } from "./headers.ts";

const CACHE_RULE: HeadersRule = {
  description: "A cached path.",
  pathPatterns: ["/cached/*"],
  headers: { "Cache-Control": IMMUTABLE_CACHE_CONTROL },
};
const TYPED_RULE: HeadersRule = {
  description: "Typed paths.",
  pathPatterns: ["/first.txt", "/second.txt"],
  headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
};
const SIGNALED_RULE: HeadersRule = {
  description: "A signaled path.",
  pathPatterns: ["/signaled.txt"],
  headers: { "Content-Signal": "search=yes" },
};
const TYPED_RULE_TEXT = `# Typed paths.
/first.txt
  Content-Type: text/plain; charset=utf-8
  X-Robots-Tag: noindex
/second.txt
  Content-Type: text/plain; charset=utf-8
  X-Robots-Tag: noindex`;
const HEADERS_FILE_TEXT = `# A cached path.
/cached/*
  Cache-Control: public, max-age=31536000, immutable

# Typed paths.
/first.txt
  Content-Type: text/plain; charset=utf-8
  X-Robots-Tag: noindex
/second.txt
  Content-Type: text/plain; charset=utf-8
  X-Robots-Tag: noindex

# A signaled path.
/signaled.txt
  Content-Signal: search=yes
`;

interface EmittedFile {
  fileName: string;
  source: string;
}

type PluginHook = (this: unknown) => void;

function callBuildStart(plugin: ReturnType<typeof headersFile>["plugin"], command: "build" | "serve" = "build") {
  (plugin.buildStart as unknown as PluginHook).call({
    environment: { config: { command, build: { assetsDir: "assets" } } },
  });
}

function emittedHeadersFileText(plugin: ReturnType<typeof headersFile>["plugin"], publicDir = "") {
  const emittedFiles: Array<EmittedFile> = [];

  (plugin.generateBundle as unknown as PluginHook).call({
    environment: { config: { publicDir } },
    emitFile: (file: EmittedFile) => emittedFiles.push(file),
    error: (message: string) => {
      throw new Error(message);
    },
  });

  return emittedFiles.find((file) => file.fileName === "_headers")?.source;
}

describe("headersRuleText", () => {
  test("writes each path pattern with every header, under the rule's description", () => {
    expect(headersRuleText(TYPED_RULE)).toBe(TYPED_RULE_TEXT);
  });
});

describe("headersFileTextFrom", () => {
  test("writes the rules sorted by their first path pattern, separated by a blank line", () => {
    expect(headersFileTextFrom([TYPED_RULE, SIGNALED_RULE, CACHE_RULE])).toBe(HEADERS_FILE_TEXT);
  });

  test("writes the same text whatever order the rules are given in", () => {
    expect(headersFileTextFrom([SIGNALED_RULE, CACHE_RULE, TYPED_RULE])).toBe(
      headersFileTextFrom([CACHE_RULE, TYPED_RULE, SIGNALED_RULE]),
    );
  });

  test("orders rules with the same first path pattern by their text", () => {
    const secondRule = { ...CACHE_RULE, description: "Second." };
    const firstRule = { ...CACHE_RULE, description: "First." };

    expect(headersFileTextFrom([secondRule, firstRule])).toBe(`# First.
/cached/*
  Cache-Control: public, max-age=31536000, immutable

# Second.
/cached/*
  Cache-Control: public, max-age=31536000, immutable
`);
  });
});

describe("matchableHeadersRuleFrom", () => {
  test.each(["/:name/file.txt", "https://example.com/file.txt"])(
    "throws when the rule has the path pattern `%s`, naming the pattern",
    (pathPattern) => {
      expect(() => matchableHeadersRuleFrom({ ...CACHE_RULE, pathPatterns: [pathPattern] })).toThrow(
        `"${pathPattern}"`,
      );
    },
  );

  test("throws when the rule has no path pattern, naming its description", () => {
    expect(() => matchableHeadersRuleFrom({ ...CACHE_RULE, pathPatterns: [] })).toThrow(`"${CACHE_RULE.description}"`);
  });
});

describe("headersMatchingPathIn", () => {
  const RULES = [CACHE_RULE, TYPED_RULE, SIGNALED_RULE].map(matchableHeadersRuleFrom);

  test("returns the headers of a rule whose path pattern is the request path", () => {
    expect(Object.fromEntries(headersMatchingPathIn(RULES, "/second.txt"))).toEqual({
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": "noindex",
    });
  });

  test.each(["/cached/file.txt", "/cached/directory/file.txt"])(
    "returns the headers of a rule whose `*` path pattern matches `%s`",
    (requestPath) => {
      expect(Object.fromEntries(headersMatchingPathIn(RULES, requestPath))).toEqual({
        "cache-control": IMMUTABLE_CACHE_CONTROL,
      });
    },
  );

  test.each(["/cached", "/first.txt/other", "/first-txt"])(
    "returns an empty map for `%s`, which no path pattern matches",
    (requestPath) => {
      expect(headersMatchingPathIn(RULES, requestPath).size).toBe(0);
    },
  );

  test("joins the values of a header two matching rules set with a comma", () => {
    const otherSignaledRule: HeadersRule = { ...SIGNALED_RULE, headers: { "Content-Signal": "ai-train=no" } };
    expect(
      headersMatchingPathIn([SIGNALED_RULE, otherSignaledRule].map(matchableHeadersRuleFrom), "/signaled.txt").get(
        "content-signal",
      ),
    ).toBe("search=yes, ai-train=no");
  });
});

describe("headersFile", () => {
  test("emits a `_headers` file containing each added rule once, sorted by its first path pattern", () => {
    const { addHeadersRules, plugin } = headersFile();

    addHeadersRules([SIGNALED_RULE]);
    addHeadersRules([CACHE_RULE, TYPED_RULE]);
    addHeadersRules([SIGNALED_RULE]);

    expect(emittedHeadersFileText(plugin)).toBe(HEADERS_FILE_TEXT);
  });

  test("adds an immutable `Cache-Control` rule for `build.assetsDir` when a build starts", () => {
    const { plugin } = headersFile();

    callBuildStart(plugin);

    expect(emittedHeadersFileText(plugin)).toBe(`# Build output file names include a hash of their contents.
/assets/*
  Cache-Control: ${IMMUTABLE_CACHE_CONTROL}
`);
  });

  test("does not add a rule for `build.assetsDir` when the dev server starts", () => {
    const { plugin } = headersFile();

    callBuildStart(plugin, "serve");

    expect(emittedHeadersFileText(plugin)).toBe("\n");
  });

  test("throws when rules are added after `_headers` was emitted, naming their path patterns", () => {
    const { addHeadersRules, plugin } = headersFile();

    addHeadersRules([CACHE_RULE]);
    emittedHeadersFileText(plugin);

    expect(() => addHeadersRules([TYPED_RULE])).toThrow("/first.txt, /second.txt");
  });

  test("fails the build when `publicDir` contains a `_headers` file", async () => {
    const publicDirectoryAbsolutePath = await mkdtemp(join(tmpdir(), "headers-"));

    try {
      await writeFile(join(publicDirectoryAbsolutePath, "_headers"), headersFileTextFrom([CACHE_RULE]));

      expect(() => emittedHeadersFileText(headersFile().plugin, publicDirectoryAbsolutePath)).toThrow(
        join(publicDirectoryAbsolutePath, "_headers"),
      );
    } finally {
      await rm(publicDirectoryAbsolutePath, { recursive: true, force: true });
    }
  });

  test("throws when a rule is added with a path pattern the dev server cannot match", () => {
    expect(() => headersFile().addHeadersRules([{ ...CACHE_RULE, pathPatterns: ["/:name/file.txt"] }])).toThrow(
      '"/:name/file.txt"',
    );
  });
});

describe("the `_headers` dev server middleware", () => {
  function responseHeadersFor(
    url: string,
    respond: (response: ServerResponse) => void = (response) => response.writeHead(200),
    rules: Array<HeadersRule> = [CACHE_RULE, TYPED_RULE],
  ) {
    const { addHeadersRules, plugin } = headersFile();
    const request = new IncomingMessage(new Socket());
    const response = new ServerResponse(request);

    request.url = url;
    addHeadersRules(rules);
    devServerMiddlewareOf(plugin)(request, response, () => respond(response));

    return { ...response.getHeaders() };
  }

  test("sets the headers of the rules whose path patterns match the request path, ignoring its query", () => {
    expect(responseHeadersFor("/cached/file.txt?query")).toEqual({ "cache-control": IMMUTABLE_CACHE_CONTROL });
  });

  test("does not set a header on a request path that no path pattern matches", () => {
    expect(responseHeadersFor("/other.txt")).toEqual({});
  });

  test.each([206, 304])("sets the headers of the matching rules on a `%i` response", (statusCode) => {
    expect(responseHeadersFor("/cached/file.txt", (response) => response.writeHead(statusCode))).toEqual({
      "cache-control": IMMUTABLE_CACHE_CONTROL,
    });
  });

  test("does not set a header on a `404` response to a request path a path pattern matches", () => {
    expect(responseHeadersFor("/cached/file.txt", (response) => response.writeHead(404))).toEqual({});
  });

  test("does not set a header on a `404` response that sets `statusCode` rather than calling `writeHead`", () => {
    const respondWithNotFound = (response: ServerResponse) => {
      response.statusCode = 404;
      response.end();
    };
    expect(responseHeadersFor("/cached/file.txt", respondWithNotFound)).toEqual({});
  });

  test("sets the headers before a later middleware responds, so one that keeps a header already set uses the rule's value", () => {
    const respondLikeStaticFileServer = (response: ServerResponse) => {
      response.writeHead(200, { "cache-control": String(response.getHeader("cache-control") ?? "no-cache") });
    }; // Vite's static file server responds this way, in place of its own `cache-control: no-cache`.
    expect(responseHeadersFor("/cached/file.txt", respondLikeStaticFileServer)).toEqual({
      "cache-control": IMMUTABLE_CACHE_CONTROL,
    });
  });

  test("preserves the value of a header a later middleware set with `setHeader`", () => {
    const respondWithMarkdown = (response: ServerResponse) => {
      response.setHeader("Content-Type", "text/markdown");
      response.writeHead(200);
    };
    expect(responseHeadersFor("/first.txt", respondWithMarkdown)).toEqual({
      "content-type": "text/markdown",
      "x-robots-tag": "noindex",
    });
  });

  test("sets a header once when the same rule was added twice", () => {
    expect(responseHeadersFor("/signaled.txt", undefined, [SIGNALED_RULE, { ...SIGNALED_RULE }])).toEqual({
      "content-signal": "search=yes",
    });
  });
});
