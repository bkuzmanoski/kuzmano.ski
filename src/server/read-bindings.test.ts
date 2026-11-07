import { beforeEach, describe, expect, test, vi } from "vitest";

import { workerEnvState as env } from "#/test-utils/worker-env.ts";

import { readBindings } from "./read-bindings.ts";

import type { MissingBindingEvent } from "./log.ts";
import type { WorkerEnv } from "cloudflare:workers";

vi.mock("./env.ts", async () => (await import("#/test-utils/worker-env.ts")).workerEnvMock());

type BindingName = keyof WorkerEnv;

// The names and event are generic labels, cast to the closed sets the types allow.
const FIRST_BINDING = "FIRST_BINDING" as BindingName;
const SECOND_BINDING = "SECOND_BINDING" as BindingName;
const BINDING_NAMES: ReadonlyArray<BindingName> = [FIRST_BINDING, SECOND_BINDING];
const EVENT = "event_binding_missing" as MissingBindingEvent;

const environmentWith = (bindings: Record<string, string | undefined>) => bindings as WorkerEnv;

beforeEach(() => {
  env.current = environmentWith({ [FIRST_BINDING]: "first", [SECOND_BINDING]: "second" });
  vi.spyOn(console, "error").mockReturnValue();
});

describe("readBindings", () => {
  test("returns every binding it names, without logging", async () => {
    await expect(readBindings(EVENT, BINDING_NAMES)).resolves.toEqual({
      [FIRST_BINDING]: "first",
      [SECOND_BINDING]: "second",
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  test.each([
    ["missing", undefined],
    ["empty", ""],
  ])("returns `null` and logs the event with the binding's name when a binding is %s", async (_label, value) => {
    env.current = environmentWith({ [FIRST_BINDING]: "first", [SECOND_BINDING]: value });

    await expect(readBindings(EVENT, BINDING_NAMES)).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ event: EVENT, binding: SECOND_BINDING }));
  });

  test("logs only the first missing binding, once, when several are missing", async () => {
    env.current = environmentWith({});

    await readBindings(EVENT, BINDING_NAMES);

    expect(console.error).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ binding: FIRST_BINDING }));
  });

  test("returns `null` and logs the Workers environment as missing when the environment is unreachable", async () => {
    env.current = null;

    await expect(readBindings(EVENT, BINDING_NAMES)).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: EVENT, binding: "the Workers environment" }),
    );
  });
});
