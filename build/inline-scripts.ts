import { VERSION as ROLLDOWN_VERSION, rolldown } from "rolldown";
import { rolldownVersion as VITE_ROLLDOWN_VERSION } from "vite";

import { fromRoot } from "./paths.ts";

import type { Plugin, ResolvedConfig } from "vite";

if (ROLLDOWN_VERSION !== VITE_ROLLDOWN_VERSION) {
  throw new Error(
    `The inline scripts plugin loaded rolldown ${ROLLDOWN_VERSION}, but Vite bundles with ${VITE_ROLLDOWN_VERSION}. Ensure that the versions of rolldown used by the plugin and Vite match.`,
  );
}

const MAX_INLINE_SCRIPT_BYTES = 1024; // These scripts block the first paint, so they must stay small.

const VIRTUAL_MODULE_PREFIX = "\0"; // Rolldown prefixes generated module IDs, such as its runtime, with a NUL byte instead of a filesystem path.
const INLINE_SCRIPT_QUERY = "inline-script";
const INLINE_SCRIPT_PREFIX = `${VIRTUAL_MODULE_PREFIX}${INLINE_SCRIPT_QUERY}:`;

const ENV_KEY_IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

// Defines the environment for Rolldown, which does not replace `import.meta.env`.
const environmentDefinitionsFrom = (env: ResolvedConfig["env"]) => ({
  "import.meta.env": JSON.stringify(env),
  ...Object.fromEntries(
    Object.entries(env)
      .filter(([key]) => ENV_KEY_IDENTIFIER.test(key))
      .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  ),
});

const definitionsFrom = (define: Record<string, unknown> | undefined) =>
  Object.fromEntries(
    Object.entries(define ?? {}).map(([key, value]) => [
      key,
      typeof value === "string" ? value : JSON.stringify(value),
    ]),
  );

/**
 * Exposes `<name>.ts?inline-script` as a module. The default export is the bundled
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

      if (!path?.endsWith(".ts") || !query?.split("&").includes(INLINE_SCRIPT_QUERY)) {
        return null;
      }

      const resolvedEntry = await this.resolve(path, importer, { skipSelf: true });

      return resolvedEntry ? `${INLINE_SCRIPT_PREFIX}${resolvedEntry.id}` : null;
    },
    async load(id) {
      if (!id.startsWith(INLINE_SCRIPT_PREFIX)) {
        return null;
      }

      const entry = id.slice(INLINE_SCRIPT_PREFIX.length);
      const bundle = await rolldown({
        input: entry,
        cwd: parent.root,
        platform: "browser",
        tsconfig: fromRoot("tsconfig.json"),
        transform: {
          target: parent.build.target === false ? undefined : parent.build.target,
          define: { ...environmentDefinitionsFrom(parent.env), ...definitionsFrom(parent.define) },
        },
        onLog: (level, log) => {
          // Route Rolldown logs through this plugin instead of its own console. Leave `logLevel`
          // at its default as setting it to "silent" prevents this handler from running.
          if (level === "warn") {
            this.warn(log);
          }
        },
      });

      try {
        const { output } = await bundle.generate({ format: "iife", minify: true, comments: false });
        const bundledScript = output.find((file) => file.type === "chunk");

        if (!bundledScript || output.length > 1) {
          this.error(`Inline script "${entry}" emitted ${output.length} output files; expected exactly one.`);
        }

        for (const moduleId of Object.keys(bundledScript.modules)) {
          if (!moduleId.startsWith(VIRTUAL_MODULE_PREFIX)) {
            this.addWatchFile(moduleId);
          }
        }

        const size = Buffer.byteLength(bundledScript.code);

        if (size > MAX_INLINE_SCRIPT_BYTES) {
          this.error(
            `Inline script "${entry}" exceeds the ${MAX_INLINE_SCRIPT_BYTES}-byte limit (${size} bytes). It may import a module that cannot be tree-shaken.`,
          );
        }

        return `export default ${JSON.stringify(bundledScript.code)};`;
      } finally {
        await bundle.close();
      }
    },
  };
}
