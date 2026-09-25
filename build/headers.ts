import { existsSync } from "node:fs";
import { join } from "node:path";

import { CLIENT_ENVIRONMENT } from "./environments.ts";
import { requestPathOf } from "./paths.ts";

import type { Plugin } from "vite";

// Cloudflare applies the rules in `_headers` to the static assets it serves.
// Each plugin declares the rules for the files it emits, and `headersFile` writes them all at once. The
// dev server applies the same rules to its responses, since it does not read `_headers`.

export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

const BUILD_OUTPUT_HEADERS_RULE: Omit<HeadersRule, "pathPatterns"> = {
  description: "Build output file names include a hash of their contents.",
  headers: { "Cache-Control": IMMUTABLE_CACHE_CONTROL },
};

const HEADERS_FILE_NAME = "_headers";

export interface HeadersRule {
  description: string;
  pathPatterns: Array<string>;
  headers: Record<string, string>;
}

/** A rule with a regular expression that matches a request path when any of its path patterns does. */
export interface MatchableHeadersRule extends HeadersRule {
  pathRegExp: RegExp;
}

export type AddHeadersRules = (rules: Array<HeadersRule>) => void;

export const headersRuleText = ({ description, pathPatterns, headers }: HeadersRule) =>
  [
    `# ${description}`,
    ...pathPatterns.flatMap((pathPattern) => [
      pathPattern,
      ...Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`),
    ]),
  ].join("\n");

/**
 * Checks that a path pattern uses only the `_headers` syntax `headersMatchingPathIn` matches: a path
 * from the root, where `*` matches any run of characters, including `/`. Throws, naming the pattern,
 * for a `:name` placeholder or a pattern that names a host, which Cloudflare supports and the dev
 * server would not match.
 */
function assertMatchablePathPattern(pathPattern: string) {
  if (!pathPattern.startsWith("/") || pathPattern.includes(":")) {
    throw new Error(
      `The \`_headers\` path pattern "${pathPattern}" must be a path from the root without placeholders.`,
    );
  }
}

const escapedForRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pathPatternRegExpFrom = (pathPattern: string) =>
  new RegExp(`^${pathPattern.split("*").map(escapedForRegExp).join(".*")}$`);

/**
 * Returns the rule with the regular expression `headersMatchingPathIn` tests request paths against.
 * Throws, naming the rule, when it has no path pattern, and naming the pattern when a path pattern
 * uses syntax the dev server would not match.
 */
export function matchableHeadersRuleFrom(rule: HeadersRule): MatchableHeadersRule {
  if (rule.pathPatterns.length === 0) {
    throw new Error(`The \`_headers\` rule "${rule.description}" must have at least one path pattern.`);
  }

  rule.pathPatterns.forEach(assertMatchablePathPattern);

  return {
    ...rule,
    pathRegExp: new RegExp(rule.pathPatterns.map((pathPattern) => pathPatternRegExpFrom(pathPattern).source).join("|")),
  };
}

/**
 * Returns the headers the rules apply to a request path, as Cloudflare applies `_headers`: every rule
 * with a matching path pattern contributes its headers, and a header two rules set has their values
 * joined with a comma.
 */
export function headersMatchingPathIn(rules: Iterable<MatchableHeadersRule>, requestPath: string): Map<string, string> {
  const headers = new Map<string, string>();

  for (const { pathRegExp, headers: ruleHeaders } of rules) {
    if (!pathRegExp.test(requestPath)) {
      continue;
    }

    for (const [name, value] of Object.entries(ruleHeaders)) {
      const headerName = name.toLowerCase();
      const existingValue = headers.get(headerName);

      headers.set(headerName, existingValue === undefined ? value : `${existingValue}, ${value}`);
    }
  }

  return headers;
}

const byCodeUnits = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0); // Compares code units rather than using `localeCompare`, so the order does not depend on the build machine's locale.

/**
 * Returns the text of a `_headers` file containing the rules sorted by their first path pattern and
 * then by their text.
 *
 * Sorting makes the file independent of the order the plugins registered their rules in.
 */
export function headersFileTextFrom(rules: Iterable<HeadersRule>): string {
  const sortedRuleTexts = [...rules]
    .map((rule) => ({ text: headersRuleText(rule), firstPathPattern: rule.pathPatterns[0] ?? "" }))
    .sort(
      (ruleA, ruleB) =>
        byCodeUnits(ruleA.firstPathPattern, ruleB.firstPathPattern) || byCodeUnits(ruleA.text, ruleB.text),
    )
    .map(({ text }) => text);

  return `${sortedRuleTexts.join("\n\n")}\n`;
}

// A rule describes the file at its paths, so a response without that file, such as a `404` under `/media/`,
// does not get the rule's headers, and is not cached as `immutable`.
const isServedFileStatusCode = (statusCode: number) => (statusCode >= 200 && statusCode < 300) || statusCode === 304;

/**
 * Creates the function plugins register `_headers` rules through, and the plugin that emits the file
 * into the client build and applies the rules to the dev server's responses.
 *
 * A plugin registers its rules from the client environment's `buildStart`, which the build finishes
 * for every plugin before any `generateBundle` runs, so the file is written once and includes every
 * rule whatever order the plugins are listed in. `vite dev` calls `buildStart` for the client
 * environment as well, before the server listens. A rule registered twice is kept once, and a rule
 * `headersMatchingPathIn` cannot match is refused when it is registered, so the dev server sets the
 * headers Cloudflare sets on every path.
 *
 * The plugin registers the rule for the hashed files Vite writes to `build.assetsDir` itself.
 */
export function headersFile(): { addHeadersRules: AddHeadersRules; plugin: Plugin } {
  const registeredRulesByText = new Map<string, MatchableHeadersRule>(); // Keyed by the rule's text, which is what `_headers` would repeat.

  let isEmitted = false;

  const addHeadersRules: AddHeadersRules = (rules) => {
    if (isEmitted) {
      throw new Error(
        `\`${HEADERS_FILE_NAME}\` was already emitted when rules for ${rules.flatMap(({ pathPatterns }) => pathPatterns).join(", ")} were added. Add rules from \`buildStart\`.`,
      );
    }

    for (const rule of rules) {
      registeredRulesByText.set(headersRuleText(rule), matchableHeadersRuleFrom(rule));
    }
  };

  return {
    addHeadersRules,
    plugin: {
      name: "kuzmano.ski:headers",
      applyToEnvironment: (environment) => environment.name === CLIENT_ENVIRONMENT,
      buildStart() {
        const { command, build } = this.environment.config;

        if (command === "build") {
          addHeadersRules([{ ...BUILD_OUTPUT_HEADERS_RULE, pathPatterns: [`/${build.assetsDir}/*`] }]);
        }
      },
      generateBundle() {
        const { publicDir } = this.environment.config;

        if (publicDir && existsSync(join(publicDir, HEADERS_FILE_NAME))) {
          // Vite copies `publicDir` into the output as well, and one of the two files would replace the other.
          this.error(`Declare the rules in \`${join(publicDir, HEADERS_FILE_NAME)}\` through \`addHeadersRules\`.`);
        }

        this.emitFile({
          type: "asset",
          fileName: HEADERS_FILE_NAME,
          source: headersFileTextFrom(registeredRulesByText.values()),
        });
        isEmitted = true;
      },
      configureServer: {
        // Registered before every other plugin's middleware, including those of `enforce: "pre"` plugins, so the
        // headers are set before any of them responds. They are set up front because Vite's static file server
        // keeps a header already on the response in place of its own, such as its `cache-control: no-cache`. A
        // later middleware's `setHeader` replaces a rule's value, and an error status removes the rule's headers.
        order: "pre",
        handler(server) {
          server.middlewares.use((request, response, next) => {
            const requestPath = requestPathOf(request);
            const ruleHeaders =
              requestPath === undefined
                ? new Map<string, string>()
                : headersMatchingPathIn(registeredRulesByText.values(), requestPath);

            if (ruleHeaders.size > 0) {
              for (const [name, value] of ruleHeaders) {
                response.setHeader(name, value);
              }

              const writeHead = response.writeHead.bind(response);

              // Node calls `writeHead` itself when a middleware writes a response without calling it, so this
              // also applies to a status set through `statusCode`.
              response.writeHead = ((...writeHeadArguments: Parameters<typeof writeHead>) => {
                if (!isServedFileStatusCode(writeHeadArguments[0])) {
                  for (const [name, value] of ruleHeaders) {
                    if (response.getHeader(name) === value) {
                      response.removeHeader(name);
                    }
                  }
                }

                return writeHead(...writeHeadArguments);
              }) as typeof writeHead;
            }

            next();
          });
        },
      },
    },
  };
}
