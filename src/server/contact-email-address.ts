import { CONTACT_EMAIL_ADDRESS_BINDING } from "./bindings.ts";
import { reportMissingBinding } from "./endpoint.ts";
import { workerEnv } from "./env.ts";

/**
 * The email address the contact window publishes, or `null` when the Worker cannot reach it.
 *
 * The email address is held as a secret rather than compiled into the client bundle. `mail.ts`
 * reads the same binding as its delivery destination, so the published email address cannot drift.
 */
export async function contactEmailAddress(): Promise<string | null> {
  let emailAddress;

  try {
    emailAddress = (await workerEnv())[CONTACT_EMAIL_ADDRESS_BINDING];
  } catch {
    emailAddress = undefined;
  }

  if (!emailAddress) {
    reportMissingBinding("contact_binding_missing", CONTACT_EMAIL_ADDRESS_BINDING);

    return null;
  }

  return emailAddress;
}
