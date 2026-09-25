import { describe, expect, test, vi } from "vitest";

import { jsonValueModulePlugin, resolvedModuleIdOf } from "./json-value-module.ts";

import type { JsonValueModule } from "./json-value-module.ts";

const MODULE_ID = "virtual:probe";
const RESOLVED_MODULE_ID = "\0virtual:probe";
const WATCHED_FILE_ABSOLUTE_PATH = "/repository/source/value.css";
const ENVIRONMENT = { name: "client", config: { command: "build" } };

interface LoadContext {
  environment: unknown;
  addWatchFile: (file: string) => void;
}

interface HotUpdateContext {
  environment: { moduleGraph: { getModuleById: (id: string) => unknown; invalidateModule: (module: unknown) => void } };
}

const probePlugin = (overrides: Partial<JsonValueModule> = {}) =>
  jsonValueModulePlugin({
    name: "probe",
    moduleId: MODULE_ID,
    exportName: "PROBE",
    load: () => Promise.resolve({ value: 1 }),
    ...overrides,
  });

const resolveIdHook = () => probePlugin().resolveId as unknown as (source: string) => string | null;
const loadHook = (overrides?: Partial<JsonValueModule>) =>
  probePlugin(overrides).load as unknown as (this: LoadContext, id: string) => Promise<string | null>;
const hotUpdateHook = (overrides?: Partial<JsonValueModule>) =>
  probePlugin(overrides).hotUpdate as unknown as (
    this: HotUpdateContext,
    options: { file: string; modules: Array<string> },
  ) => Array<unknown> | void;
const loadContext = () => ({ environment: ENVIRONMENT, addWatchFile: vi.fn<(file: string) => void>() });
const hotUpdateContext = (loaded: unknown) => ({
  environment: {
    moduleGraph: {
      getModuleById: (id: string) => (id === RESOLVED_MODULE_ID ? loaded : null),
      invalidateModule: vi.fn<(module: unknown) => void>(),
    },
  },
});

describe("resolvedModuleIdOf", () => {
  test("prefixes the module ID with `\\0`", () => {
    expect(resolvedModuleIdOf(MODULE_ID)).toBe(RESOLVED_MODULE_ID);
  });
});

describe("jsonValueModulePlugin", () => {
  test("resolves its own module ID, and returns `null` for any other source", () => {
    const resolveId = resolveIdHook();

    expect(resolveId(MODULE_ID)).toBe(RESOLVED_MODULE_ID);
    expect(resolveId("virtual:other-module")).toBeNull();
  });

  test("serves the value it loads as the named export, and returns `null` for another module ID", async () => {
    const load = loadHook();

    expect(await load.call(loadContext(), RESOLVED_MODULE_ID)).toBe('export const PROBE = {"value":1};');
    expect(await load.call(loadContext(), "\0virtual:other-module")).toBeNull();
  });

  test("serves a value that `load` returns synchronously", async () => {
    const load = loadHook({ load: () => ["entry"] });

    expect(await load.call(loadContext(), RESOLVED_MODULE_ID)).toBe('export const PROBE = ["entry"];');
  });

  test("serves the value `load` returns each time the module is loaded", async () => {
    const values = [{ value: 1 }, { value: 2 }];
    const load = loadHook({ load: () => Promise.resolve(values.shift()) });

    expect(await load.call(loadContext(), RESOLVED_MODULE_ID)).toBe('export const PROBE = {"value":1};');
    expect(await load.call(loadContext(), RESOLVED_MODULE_ID)).toBe('export const PROBE = {"value":2};');
  });

  test("passes the environment loading the module to `load`", async () => {
    const load = vi.fn<JsonValueModule["load"]>(() => ({}));

    await loadHook({ load }).call(loadContext(), RESOLVED_MODULE_ID);

    expect(load).toHaveBeenCalledWith(ENVIRONMENT);
  });

  test("records each file in `watchFiles` as a watched file when the module is loaded", async () => {
    const context = loadContext();
    const secondWatchedFileAbsolutePath = "/repository/source/second-value.css";

    await loadHook({ watchFiles: [WATCHED_FILE_ABSOLUTE_PATH, secondWatchedFileAbsolutePath] }).call(
      context,
      RESOLVED_MODULE_ID,
    );

    expect(context.addWatchFile.mock.calls).toEqual([[WATCHED_FILE_ABSOLUTE_PATH], [secondWatchedFileAbsolutePath]]);
  });

  test("records a watched file only when the module is loaded", async () => {
    const context = loadContext();

    await loadHook({ watchFiles: [WATCHED_FILE_ABSOLUTE_PATH] }).call(context, "\0virtual:other-module");

    expect(context.addWatchFile).not.toHaveBeenCalled();
  });

  test("invalidates the loaded module when a watched file is edited, and returns it as an updated module", () => {
    const loadedModule = { id: RESOLVED_MODULE_ID };
    const context = hotUpdateContext(loadedModule);

    expect(
      hotUpdateHook({ watchFiles: [WATCHED_FILE_ABSOLUTE_PATH] }).call(context, {
        file: WATCHED_FILE_ABSOLUTE_PATH,
        modules: ["module"],
      }),
    ).toEqual(["module", loadedModule]);
    expect(context.environment.moduleGraph.invalidateModule).toHaveBeenCalledWith(loadedModule);
  });

  test("returns `undefined` from `hotUpdate`, and does not invalidate the module, when a file other than a watched file is edited", () => {
    const context = hotUpdateContext({ id: RESOLVED_MODULE_ID });

    expect(
      hotUpdateHook({ watchFiles: [WATCHED_FILE_ABSOLUTE_PATH] }).call(context, {
        file: "/repository/source/other.css",
        modules: [],
      }),
    ).toBeUndefined();
    expect(context.environment.moduleGraph.invalidateModule).not.toHaveBeenCalled();
  });

  test("returns `undefined` from `hotUpdate`, and does not invalidate the module, when a watched file is edited before the module is loaded", () => {
    const context = hotUpdateContext(null);

    expect(
      hotUpdateHook({ watchFiles: [WATCHED_FILE_ABSOLUTE_PATH] }).call(context, {
        file: WATCHED_FILE_ABSOLUTE_PATH,
        modules: [],
      }),
    ).toBeUndefined();
    expect(context.environment.moduleGraph.invalidateModule).not.toHaveBeenCalled();
  });

  test("returns `undefined` from `hotUpdate`, and does not invalidate the module, when configured without watched files", () => {
    const context = hotUpdateContext({ id: RESOLVED_MODULE_ID });

    expect(hotUpdateHook().call(context, { file: WATCHED_FILE_ABSOLUTE_PATH, modules: [] })).toBeUndefined();
    expect(context.environment.moduleGraph.invalidateModule).not.toHaveBeenCalled();
  });
});
