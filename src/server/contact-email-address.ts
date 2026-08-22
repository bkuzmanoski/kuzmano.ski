import { CONTACT_EMAIL_ADDRESS_BINDING } from "./bindings";
import { workerEnv } from "./env";

/**
 * The email address the contact window publishes, or `null` when the Worker
 * cannot reach it.
 *
 * The email address is held as a secret rather than compiled into the client
 * bundle. `mail.ts` reads the same binding as its delivery destination, so
 * the published email address cannot drift.
 */
export async function contactEmailAddress(): Promise<string | null> {
  let emailAddress;

  try {
    emailAddress = (await workerEnv())[CONTACT_EMAIL_ADDRESS_BINDING];
  } catch {
    emailAddress = undefined;
  }

  if (!emailAddress) {
    console.error({
      event: "contact_binding_missing",
      binding: CONTACT_EMAIL_ADDRESS_BINDING,
      message: `The worker could not access \`${CONTACT_EMAIL_ADDRESS_BINDING}\``,
    });

    return null;
  }

  return emailAddress;
}
