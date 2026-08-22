import { SITE_NAME } from "#/config/site";

import { CONTACT_EMAIL_ADDRESS_BINDING, SEND_EMAIL_BINDING } from "./bindings";
import { workerEnv } from "./env";

const SENDER = { name: SITE_NAME, email: "no-reply@kuzmano.ski" };

export interface OutgoingMessage {
  replyTo: string;
  subject: string;
  text: string;
}
/**
 * `throttled` and `exhausted` mean the account's send quota has run out and may recover on retry.
 * Every other failure is a misconfiguration that cannot recover this way, so it collapses to
 * `unavailable` and the diagnosis is left to the log.
 */
export type Delivery = "sent" | "throttled" | "exhausted" | "unavailable";

const QUOTA_OUTCOMES: Record<string, Delivery> = {
  E_RATE_LIMIT_EXCEEDED: "throttled",
  E_DAILY_LIMIT_EXCEEDED: "exhausted",
};

function failureCode(error: unknown): string {
  const code: unknown = error instanceof Error ? (error as Error & { code?: unknown }).code : undefined;
  return typeof code === "string" ? code : "unknown";
}

function reportUnavailable(binding: string): "unavailable" {
  console.error({
    event: "contact_binding_missing",
    binding,
    message: `The worker could not access \`${binding}\``,
  });
  return "unavailable";
}

export async function deliver(message: OutgoingMessage): Promise<Delivery> {
  let env;

  try {
    env = await workerEnv();
  } catch {
    return reportUnavailable("the Workers environment");
  }

  const sendMailBinding = env[SEND_EMAIL_BINDING];
  const destinationBinding = env[CONTACT_EMAIL_ADDRESS_BINDING];

  if (!sendMailBinding) {
    return reportUnavailable(SEND_EMAIL_BINDING);
  }

  if (!destinationBinding) {
    return reportUnavailable(CONTACT_EMAIL_ADDRESS_BINDING);
  }

  try {
    await sendMailBinding.send({
      from: SENDER,
      to: destinationBinding,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
    });
    return "sent";
  } catch (error) {
    const code = failureCode(error);
    const delivery = QUOTA_OUTCOMES[code] ?? "unavailable";

    console.error({
      event: "contact_delivery_failed",
      code,
      delivery,
      from: SENDER.email,
      to: destinationBinding,
      message: error instanceof Error ? error.message : String(error),
    });

    return delivery;
  }
}
