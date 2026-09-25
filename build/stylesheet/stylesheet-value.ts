import { jsonValueModulePlugin } from "../json-value-module.ts";
import { STYLESHEET_FILE_PATH, fromRoot } from "../paths.ts";

import type { JsonValueModule } from "../json-value-module.ts";
import type { Plugin } from "vite";

/** Configuration for a virtual module backed by a value `load` reads from `STYLESHEET_FILE_PATH`. */
export type StylesheetValueModule = Omit<JsonValueModule, "watchFiles">;

/** Exposes a JSON-serialized value read from `STYLESHEET_FILE_PATH` through a virtual module. */
export const stylesheetValuePlugin = (stylesheetValueModule: StylesheetValueModule): Plugin =>
  jsonValueModulePlugin({ ...stylesheetValueModule, watchFiles: [fromRoot(STYLESHEET_FILE_PATH)] });
