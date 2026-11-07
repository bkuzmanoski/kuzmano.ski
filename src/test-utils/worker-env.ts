import type { WorkerEnv } from "cloudflare:workers";

// A `vi.mock` factory for `#/server/env.ts`, which resolves `workerEnv` to the bindings a suite sets in
// `workerEnvState.current`.

/** Bindings resolved by `workerEnv`, or `null` to simulate execution outside Workers. */
export const workerEnvState: { current: WorkerEnv | null } = { current: {} };

export const workerEnvMock = () => ({
  workerEnv: () =>
    workerEnvState.current === null
      ? Promise.reject(new Error("No bindings."))
      : Promise.resolve(workerEnvState.current),
});
