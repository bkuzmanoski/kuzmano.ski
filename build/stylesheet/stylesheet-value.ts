import { STYLESHEET_FILE_PATH, fromRoot } from "../paths.ts";

import type { Plugin } from "vite";

/** Configuration for a virtual module backed by a stylesheet value. */
export interface StylesheetValueModule {
  name: string;
  moduleId: string;
  exportName: string;
  read: () => Promise<unknown>;
}

/** Creates a virtual module that exports a JSON-serialized value read from `STYLESHEET_FILE_PATH`. */
export function stylesheetValuePlugin({ name, moduleId, exportName, read }: StylesheetValueModule): Plugin {
  const resolvedModuleId = `\0${moduleId}`;
  return {
    name,
    enforce: "pre",
    resolveId: (source) => (source === moduleId ? resolvedModuleId : null),
    async load(id) {
      if (id !== resolvedModuleId) {
        return null;
      }

      this.addWatchFile(fromRoot(STYLESHEET_FILE_PATH));

      return `export const ${exportName} = ${JSON.stringify(await read())};`;
    },
    hotUpdate({ file, modules }) {
      if (file !== fromRoot(STYLESHEET_FILE_PATH)) {
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
