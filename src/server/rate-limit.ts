import { workerEnv } from "./env.ts";

import type { RateLimitBindingName } from "./bindings.ts";

/**
 * Whether `rateLimitKey` is still within the budget of `bindingName`, per the Workers rate limit binding.
 *
 * Fails open: a deploy that has not configured the binding, or a binding that errors, lets the request through.
 */
export async function isWithinRateLimit(bindingName: RateLimitBindingName, rateLimitKey: string): Promise<boolean> {
  try {
    const binding = (await workerEnv())[bindingName];

    if (!binding) {
      return true;
    }

    const { success } = await binding.limit({ key: rateLimitKey });

    return success;
  } catch {
    return true;
  }
}
