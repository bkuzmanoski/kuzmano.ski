import { SITE_NAME } from "#/config/site.ts";

import { CONTACT_EMAIL_ADDRESS_BINDING, SEND_EMAIL_BINDING } from "./bindings.ts";
import { workerEnv } from "./env.ts";
import { errorMessageOf, logServerEvent, reportMissingBinding } from "./log.ts";

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
export type DeliveryResult = "sent" | "throttled" | "exhausted" | "unavailable";

const DELIVERY_BY_QUOTA_ERROR_CODE: Record<string, DeliveryResult> = {
  E_RATE_LIMIT_EXCEEDED: "throttled",
  E_DAILY_LIMIT_EXCEEDED: "exhausted",
};

function errorCodeOf(error: unknown): string {
  const code: unknown = error instanceof Error ? (error as Error & { code?: unknown }).code : undefined;
  return typeof code === "string" ? code : "unknown";
}

function reportMissingContactBinding(binding: string): "unavailable" {
  reportMissingBinding("contact_binding_missing", binding);
  return "unavailable";
}

export async function deliverMessage(message: OutgoingMessage): Promise<DeliveryResult> {
  let env;

  try {
    env = await workerEnv();
  } catch {
    return reportMissingContactBinding("the Workers environment");
  }

  const sendEmailBinding = env[SEND_EMAIL_BINDING];
  const contactEmailAddress = env[CONTACT_EMAIL_ADDRESS_BINDING];

  if (!sendEmailBinding) {
    return reportMissingContactBinding(SEND_EMAIL_BINDING);
  }

  if (!contactEmailAddress) {
    return reportMissingContactBinding(CONTACT_EMAIL_ADDRESS_BINDING);
  }

  try {
    await sendEmailBinding.send({
      from: SENDER,
      to: contactEmailAddress,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
    });
    return "sent";
  } catch (error) {
    const code = errorCodeOf(error);
    const deliveryResult = DELIVERY_BY_QUOTA_ERROR_CODE[code] ?? "unavailable";

    logServerEvent("contact_delivery_failed", {
      code,
      delivery: deliveryResult,
      from: SENDER.email,
      to: contactEmailAddress,
      message: errorMessageOf(error),
    });

    return deliveryResult;
  }
}
