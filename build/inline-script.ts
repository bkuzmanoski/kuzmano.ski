import { build } from "vite";

import type { Plugin, ResolvedConfig } from "vite";

const QUERY = "inline-script";
const PREFIX = "\0inline-script:";

// These scripts block the first paint, so they must stay small. The limit is set against
// the current scripts, which are 250-350 bytes each. It leaves room for another script
// but catches a non-lead module import that pulls in a large module.
const MAX_BYTES = 1024;

/**
 * Serves `<name>.ts?inline-script` as a module. The default export is the bundled
 * and minified source of that entry for inlining in a `<script>` tag.
 *
 * The plugin bundles the entry instead of reading it as written, so a pre-hydration
 * script can reuse constants and helpers from the app.
 *
 * A script can safely reach leaf modules only. Tree-shaking cannot remove a module
 * that runs code at initialization, so an import that reaches React puts React in
 * the document head.
 */
export function inlineScriptPlugin(): Plugin {
  let parent: ResolvedConfig;

  return {
    name: "kuzmano.ski:inline-script",
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
        // The config file is not loaded here. It would run the full plugin pipeline
        // of the app over the script and register this plugin again. Only the config
        // that a script can observe is forwarded, so `import.meta.env` and `define`
        // resolve as they do in the app. Forward any other option from `vite.config.ts`
        // that a script needs.
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

      // Run the nested build again when the entry or one of its imports changes.
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
