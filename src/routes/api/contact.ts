import { createFileRoute } from "@tanstack/react-router";

import { parseSubmission } from "#/lib/contact/message";
import { isRecord } from "#/lib/guards";
import { deliver } from "#/server/mail";
import type { Delivery } from "#/server/mail";
import { isWithinRateLimit } from "#/server/rate-limit";
import { isOversized, isSameOrigin } from "#/server/request";

const RATE_LIMIT_FALLBACK_KEY = "unknown";
const DELIVERY_STATUS: Record<Delivery, number> = {
  sent: 204,
  throttled: 429,
  unavailable: 502,
  exhausted: 503,
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const senderKey = (request: Request) => request.headers.get("cf-connecting-ip") ?? RATE_LIMIT_FALLBACK_KEY;

export const Route = createFileRoute("/api/contact")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isSameOrigin(request)) {
          return new Response(null, { status: 403 });
        }

        if (isOversized(request)) {
          return new Response(null, { status: 413 });
        }

        if (!(await isWithinRateLimit(senderKey(request)))) {
          return new Response(null, { status: 429 });
        }

        const body = await request.text();

        if (isOversized(body)) {
          return new Response(null, { status: 413 });
        }

        let submission: unknown;

        try {
          submission = JSON.parse(body);
        } catch {
          return new Response(null, { status: 400 });
        }

        if (!isRecord(submission)) {
          return new Response(null, { status: 400 });
        }

        const parsedSubmission = parseSubmission(submission);

        if (!parsedSubmission.ok) {
          switch (parsedSubmission.reason) {
            case "rejected":
              return new Response(null, { status: 204 }); // A bot trap; answered as success.

            case "malformed":
              return new Response(null, { status: 400 });

            case "invalid":
              return json({ errors: parsedSubmission.errors }, 400);
          }
        }

        const { from, message } = parsedSubmission.fields;
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
