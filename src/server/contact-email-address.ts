import { CONTACT_EMAIL_ADDRESS_BINDING } from "./bindings.ts";
import { workerEnv } from "./env.ts";
import { reportMissingBinding } from "./log.ts";

const reportMissingContactBinding = (binding: string) => reportMissingBinding("contact_binding_missing", binding);

export async function readContactEmailAddress(): Promise<string | null> {
  let env;

  try {
    env = await workerEnv();
  } catch {
    reportMissingContactBinding("the Workers environment");
    return null;
  }

  const emailAddress = env[CONTACT_EMAIL_ADDRESS_BINDING];

  if (!emailAddress) {
    reportMissingContactBinding(CONTACT_EMAIL_ADDRESS_BINDING);
    return null;
  }

  return emailAddress;
}
