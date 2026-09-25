import { describe, expect, test, vi } from "vitest";

import { STYLESHEET_FILE_PATH, fromRoot } from "../paths.ts";

import { stylesheetValuePlugin } from "./stylesheet-value.ts";

const RESOLVED_MODULE_ID = "\0virtual:probe";

interface LoadContext {
  addWatchFile: (file: string) => void;
}

interface HotUpdateContext {
  environment: { moduleGraph: { getModuleById: (id: string) => unknown; invalidateModule: (module: unknown) => void } };
}

const probePlugin = () =>
  stylesheetValuePlugin({
    name: "probe",
    moduleId: "virtual:probe",
    exportName: "PROBE",
    load: () => Promise.resolve({ gutter: 16 }),
  });

describe("stylesheetValuePlugin", () => {
  test("serves the value it reads, and records the stylesheet as a watched file", async () => {
    const context = { addWatchFile: vi.fn<(file: string) => void>() };
    const load = probePlugin().load as unknown as (this: LoadContext, id: string) => Promise<string | null>;

    expect(await load.call(context, RESOLVED_MODULE_ID)).toBe('export const PROBE = {"gutter":16};');
    expect(context.addWatchFile).toHaveBeenCalledWith(fromRoot(STYLESHEET_FILE_PATH));
  });

  test("invalidates the loaded module when the stylesheet is edited", () => {
    const loadedModule = { id: RESOLVED_MODULE_ID };
    const context = {
      environment: { moduleGraph: { getModuleById: () => loadedModule, invalidateModule: vi.fn() } },
    };
    const hotUpdate = probePlugin().hotUpdate as unknown as (
      this: HotUpdateContext,
      options: { file: string; modules: Array<unknown> },
    ) => Array<unknown> | void;

    expect(hotUpdate.call(context, { file: fromRoot(STYLESHEET_FILE_PATH), modules: [] })).toEqual([loadedModule]);
    expect(context.environment.moduleGraph.invalidateModule).toHaveBeenCalledWith(loadedModule);
  });
});
