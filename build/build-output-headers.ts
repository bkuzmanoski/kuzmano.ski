import { resolve } from "node:path";

import { CLIENT_ENVIRONMENT } from "./environments.ts";
import { addHeadersRules } from "./headers.ts";

import type { HeadersRule } from "./headers.ts";
import type { Plugin } from "vite";

const BUILD_OUTPUT_HEADERS_RULE: Omit<HeadersRule, "pathPatterns"> = {
  description: "Build output file names include a hash of their contents.",
  headers: { "Cache-Control": "public, max-age=31536000, immutable" },
};

/** Adds immutable cache headers for the hashed files Vite writes to `build.assetsDir`. */
export function buildOutputHeadersPlugin(): Plugin {
  return {
    name: "kuzmano.ski:build-output-headers",
    applyToEnvironment: (environment) => environment.name === CLIENT_ENVIRONMENT,
    async writeBundle() {
      const { root, build } = this.environment.config;
      await addHeadersRules(resolve(root, build.outDir), [
        { ...BUILD_OUTPUT_HEADERS_RULE, pathPatterns: [`/${build.assetsDir}/*`] },
      ]);
    },
  };
}
