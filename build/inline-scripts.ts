import { build } from "vite";

import type { Plugin, ResolvedConfig } from "vite";

const QUERY = "inline-script";
const PREFIX = "\0inline-script:";

const MAX_BYTES = 1024; // These scripts block the first paint, so they must stay small.

/**
 * Serves `<name>.ts?inline-script` as a module. The default export is the bundled
 * and minified source of that entry for inlining in a `<script>` tag.
 *
 * The plugin bundles the entry instead of reading it as written, so a pre-hydration
 * script can reuse constants and helpers from the app.
 *
 * Warning: A script can safely reach leaf modules only. Tree-shaking cannot remove
 * a module that runs code at initialization, so an import that reaches React puts
 * React in the document head.
 */
export function inlineScriptsPlugin(): Plugin {
  let parent: ResolvedConfig;
  return {
    name: "kuzmano.ski:inline-scripts",
    enforce: "pre",
    configResolved(config) {
      parent = config;
    },
    async resolveId(source, importer) {
      const [path, query] = source.split("?");

      if (!path?.endsWith(".ts") || !query?.split("&").includes(QUERY)) {
        return null;
      }

      const resolved = await this.resolve(path, importer, { skipSelf: true });

      return resolved ? `${PREFIX}${resolved.id}` : null;
    },
    async load(id) {
      if (!id.startsWith(PREFIX)) {
        return null;
      }

      const entry = id.slice(PREFIX.length);
      const result = await build({
        configFile: false,
        root: parent.root,
        mode: parent.mode,
        define: parent.define,
        envDir: parent.envDir,
        envPrefix: parent.envPrefix,
        logLevel: "error",
        resolve: { tsconfigPaths: true },
        build: {
          write: false,
          minify: true,
          lib: { entry, formats: ["iife"], name: "inlineScript" },
        },
      });

      const output = Array.isArray(result) ? result[0]?.output : "output" in result ? result.output : undefined;
      const chunk = output?.find((item) => item.type === "chunk");

      if (!chunk) {
        this.error(`No chunk emitted for inline script: ${entry}`);
      }

      for (const moduleId of chunk.moduleIds) {
        this.addWatchFile(moduleId);
      }

      const size = Buffer.byteLength(chunk.code);

      if (size > MAX_BYTES) {
        this.error(
          `Inline script "${entry}" is ${size} bytes, over the ${MAX_BYTES} byte limit. ` +
            "It may import a module that tree-shaking cannot remove. Make sure that every " +
            "module it reaches runs no code at initialization.",
        );
      }

      return `export default ${JSON.stringify(chunk.code)};`;
    },
  };
}
