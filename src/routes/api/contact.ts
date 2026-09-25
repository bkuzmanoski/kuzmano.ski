import { createFileRoute } from "@tanstack/react-router";

import { parseSubmission } from "#/lib/contact/message.ts";
import { CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING, SEND_EMAIL_RATELIMIT_BINDING } from "#/server/bindings.ts";
import { readContactEmailAddress } from "#/server/contact-email-address.ts";
import { jsonResponse, readSubmission, refusalForGet, responseForRefusedSubmission } from "#/server/endpoint.ts";
import { deliverMessage } from "#/server/mail.ts";
import type { DeliveryResult } from "#/server/mail.ts";

const DELIVERY_STATUS: Record<DeliveryResult, number> = {
  sent: 204,
  throttled: 429,
  unavailable: 502,
  exhausted: 503,
};

export const Route = createFileRoute("/api/contact")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const refusal = await refusalForGet(request, CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING);

        if (refusal) {
          return refusal;
        }

        const emailAddress = await readContactEmailAddress();

        return emailAddress === null ? new Response(null, { status: 502 }) : jsonResponse({ emailAddress }, 200);
      },
      POST: async ({ request }) => {
        const receivedSubmission = await readSubmission(request, SEND_EMAIL_RATELIMIT_BINDING);

        if (!receivedSubmission.ok) {
          return receivedSubmission.response;
        }

        const parsedSubmission = parseSubmission(receivedSubmission.fields);

        if (!parsedSubmission.ok) {
          return responseForRefusedSubmission(parsedSubmission);
        }

        const { from, message } = parsedSubmission.value;
        const delivery = await deliverMessage({
          replyTo: from,
          subject: `Message from ${from}`,
          text: message,
        });

        return new Response(null, { status: DELIVERY_STATUS[delivery] });
      },
    },
  },
});
