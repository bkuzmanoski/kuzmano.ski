import { CONTACT_EMAIL_ADDRESS_BINDING } from "./bindings.ts";
import { reportMissingBinding } from "./endpoint.ts";
import { workerEnv } from "./env.ts";

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
