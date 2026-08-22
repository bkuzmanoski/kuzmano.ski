import { SEND_EMAIL_RATELIMIT_BINDING } from "./bindings";
import { workerEnv } from "./env";

/**
 * Whether `bindingKey` is still within its budget, per the Workers rate limit binding.
 *
 * Fails open: a deploy that has not configured the binding, or a binding that errors,
 * lets the request through.
 */
export async function isWithinRateLimit(bindingKey: string): Promise<boolean> {
  try {
    const binding = (await workerEnv())[SEND_EMAIL_RATELIMIT_BINDING];

    if (!binding) {
      return true;
    }

    const { success } = await binding.limit({ key: bindingKey });

    return success;
  } catch {
    return true;
  }
}
