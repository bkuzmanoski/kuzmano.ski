import { createFileRoute } from "@tanstack/react-router";

import { parseSubmission } from "#/lib/contact/message";
import { CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING, SEND_EMAIL_RATELIMIT_BINDING } from "#/server/bindings";
import { contactEmailAddress } from "#/server/contact-email-address";
import { json, readSubmission, refusalFor, senderKey } from "#/server/endpoint";
import { deliver } from "#/server/mail";
import type { Delivery } from "#/server/mail";
import { isWithinRateLimit } from "#/server/rate-limit";
import { isSameSite } from "#/server/request";

const DELIVERY_STATUS: Record<Delivery, number> = {
  sent: 204,
  throttled: 429,
  unavailable: 502,
  exhausted: 503,
};

export const Route = createFileRoute("/api/contact")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isSameSite(request)) {
          return new Response(null, { status: 403 });
        }

        if (!(await isWithinRateLimit(CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING, senderKey(request)))) {
          return new Response(null, { status: 429 });
        }

        const emailAddress = await contactEmailAddress();

        return emailAddress === null ? new Response(null, { status: 502 }) : json({ emailAddress }, 200);
      },
      POST: async ({ request }) => {
        const receivedSubmission = await readSubmission(request, SEND_EMAIL_RATELIMIT_BINDING);

        if (!receivedSubmission.ok) {
          return receivedSubmission.response;
        }

        const parsedSubmission = parseSubmission(receivedSubmission.fields);

        if (!parsedSubmission.ok) {
          return refusalFor(parsedSubmission);
        }

        const { from, message } = parsedSubmission.value;
        const delivery = await deliver({
          replyTo: from,
          subject: `Message from ${from}`,
          text: message,
        });

        return new Response(null, { status: DELIVERY_STATUS[delivery] });
      },
    },
  },
});
