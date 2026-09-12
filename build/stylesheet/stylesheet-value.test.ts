import { describe, expect, test, vi } from "vitest";

import { STYLESHEET_FILE_PATH, fromRoot } from "../paths.ts";

import { stylesheetValuePlugin } from "./stylesheet-value.ts";

const MODULE_ID = "virtual:probe";
const RESOLVED_MODULE_ID = `\0${MODULE_ID}`;

const probePlugin = (read: () => Promise<unknown> = () => Promise.resolve({ gutter: 16 })) =>
  stylesheetValuePlugin({ name: "probe", moduleId: MODULE_ID, exportName: "PROBE", read });

interface LoadContext {
  addWatchFile: (file: string) => void;
}

interface HotUpdateContext {
  environment: { moduleGraph: { getModuleById: (id: string) => unknown; invalidateModule: (module: unknown) => void } };
}

const resolveIdHook = (read?: () => Promise<unknown>) =>
  probePlugin(read).resolveId as unknown as (source: string) => string | null;
const loadHook = (read?: () => Promise<unknown>) =>
  probePlugin(read).load as unknown as (this: LoadContext, id: string) => Promise<string | null>;
const hotUpdateHook = () =>
  probePlugin().hotUpdate as unknown as (
    this: HotUpdateContext,
    options: { file: string; modules: Array<string> },
  ) => Array<unknown> | void;
const watchContext = () => ({ addWatchFile: vi.fn<(file: string) => void>() });
const hotUpdateContext = (loaded: unknown) => ({
  environment: {
    moduleGraph: {
      getModuleById: (id: string) => (id === RESOLVED_MODULE_ID ? loaded : null),
      invalidateModule: vi.fn<(module: unknown) => void>(),
    },
  },
});

describe("stylesheetValuePlugin", () => {
  test("resolves its own module id, and returns null for any other source", () => {
    const resolveId = resolveIdHook();

    expect(resolveId(MODULE_ID)).toBe(RESOLVED_MODULE_ID);
    expect(resolveId("virtual:other-module")).toBeNull();
  });

  test("serves the value it reads as the named export, and returns null for another module id", async () => {
    const load = loadHook();

    expect(await load.call(watchContext(), RESOLVED_MODULE_ID)).toBe('export const PROBE = {"gutter":16};');
    expect(await load.call(watchContext(), "\0virtual:other-module")).toBeNull();
  });

  test("reads the value again on every load", async () => {
    const values = [{ gutter: 16 }, { gutter: 24 }];
    const load = loadHook(() => Promise.resolve(values.shift()));

    expect(await load.call(watchContext(), RESOLVED_MODULE_ID)).toBe('export const PROBE = {"gutter":16};');
    expect(await load.call(watchContext(), RESOLVED_MODULE_ID)).toBe('export const PROBE = {"gutter":24};');
  });

  test("records the stylesheet as a watched file when the module is loaded", async () => {
    const context = watchContext();

    await loadHook().call(context, RESOLVED_MODULE_ID);

    expect(context.addWatchFile).toHaveBeenCalledWith(fromRoot(STYLESHEET_FILE_PATH));
  });

  test("invalidates the loaded module when the stylesheet is edited, and returns it as an updated module", () => {
    const loadedModule = { id: RESOLVED_MODULE_ID };
    const context = hotUpdateContext(loadedModule);

    expect(hotUpdateHook().call(context, { file: fromRoot(STYLESHEET_FILE_PATH), modules: ["module"] })).toEqual([
      "module",
      loadedModule,
    ]);
    expect(context.environment.moduleGraph.invalidateModule).toHaveBeenCalledWith(loadedModule);
  });

  test("returns no updated modules when a file other than the stylesheet is edited", () => {
    const context = hotUpdateContext({ id: RESOLVED_MODULE_ID });

    expect(hotUpdateHook().call(context, { file: fromRoot("src/app/root-document.tsx"), modules: [] })).toBeUndefined();
    expect(context.environment.moduleGraph.invalidateModule).not.toHaveBeenCalled();
  });

  test("returns no updated modules when the stylesheet is edited before the module is loaded", () => {
    const context = hotUpdateContext(null);

    expect(hotUpdateHook().call(context, { file: fromRoot(STYLESHEET_FILE_PATH), modules: [] })).toBeUndefined();
    expect(context.environment.moduleGraph.invalidateModule).not.toHaveBeenCalled();
  });
});
