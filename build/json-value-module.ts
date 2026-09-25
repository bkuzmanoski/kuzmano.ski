// This module imports only types, so a plugin built on it can be registered in `/vitest.config.ts`
// without loading what the plugin's own loader reads.
import type { Environment, Plugin } from "vite";

/** Configuration for a virtual module that exports one JSON-serializable value. */
export interface JsonValueModule {
  name: string;
  moduleId: string;
  exportName: string;
  load: (environment: Environment) => unknown; // Called on every load, with the environment loading the module.
  watchFiles?: Array<string>; // Absolute paths the value is read from.
}

/** The ID a virtual module resolves to. The `\0` prefix excludes it from other plugins' file handling. */
export const resolvedModuleIdOf = (moduleId: string) => `\0${moduleId}`;

/**
 * Exposes the value `load` returns as the named export of a virtual module.
 *
 * Each file in `watchFiles` is recorded as a dependency of the module in the dev server's module graph,
 * and an edit to one invalidates the module under `vite dev`.
 */
export function jsonValueModulePlugin({ name, moduleId, exportName, load, watchFiles = [] }: JsonValueModule): Plugin {
  const resolvedModuleId = resolvedModuleIdOf(moduleId);
  return {
    name,
    enforce: "pre",
    resolveId: (source) => (source === moduleId ? resolvedModuleId : null),
    async load(id) {
      if (id !== resolvedModuleId) {
        return null;
      }

      watchFiles.forEach((file) => this.addWatchFile(file));

      return `export const ${exportName} = ${JSON.stringify(await load(this.environment))};`;
    },
    hotUpdate({ file, modules }) {
      if (!watchFiles.includes(file)) {
        return;
      }

      const staleModule = this.environment.moduleGraph.getModuleById(resolvedModuleId);

      if (!staleModule) {
        return;
      }

      this.environment.moduleGraph.invalidateModule(staleModule);

      return [...modules, staleModule];
    },
  };
}
