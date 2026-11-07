import { CONTACT_EMAIL_ADDRESS_BINDING } from "./bindings.ts";
import { readBindings } from "./read-bindings.ts";

export async function readContactEmailAddress(): Promise<string | null> {
  const bindings = await readBindings("contact_binding_missing", [CONTACT_EMAIL_ADDRESS_BINDING]);
  return bindings?.[CONTACT_EMAIL_ADDRESS_BINDING] ?? null;
}
