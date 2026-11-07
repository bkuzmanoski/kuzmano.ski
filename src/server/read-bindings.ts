import { workerEnv } from "./env.ts";
import { logServerEvent } from "./log.ts";

import type { MissingBindingEvent } from "./log.ts";
import type { WorkerEnv } from "cloudflare:workers";

type Bindings<TName extends keyof WorkerEnv> = { [K in TName]: NonNullable<WorkerEnv[K]> };

function reportMissingBinding(event: MissingBindingEvent, binding: string) {
  logServerEvent(event, { binding, message: `The worker could not access \`${binding}\`` });
}

/**
 * Returns the requested bindings, or `null` if the Worker cannot access the environment or any binding. Logs `event`
 * for the first inaccessible resource.
 */
export async function readBindings<const TName extends keyof WorkerEnv>(
  event: MissingBindingEvent,
  names: ReadonlyArray<TName>,
): Promise<Bindings<TName> | null> {
  let env: WorkerEnv;

  try {
    env = await workerEnv();
  } catch {
    reportMissingBinding(event, "the Workers environment");
    return null;
  }

  const bindings: Partial<Bindings<TName>> = {};

  for (const name of names) {
    const binding = env[name];

    if (!binding) {
      reportMissingBinding(event, name);
      return null;
    }

    bindings[name] = binding;
  }

  return bindings as Bindings<TName>;
}
