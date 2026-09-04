import { createFileRoute } from "@tanstack/react-router";

import { readSubmission } from "#/server/endpoint.ts";

const MAX_MESSAGE_LENGTH = 500;
const MAX_ROUTE_LENGTH = 500;
const MAX_KIND_LENGTH = 100;
const MAX_STACK_LENGTH = 4_000;

function stringField(value: Record<string, unknown>, name: string, maximumLength: number): string | undefined {
  const field = value[name];
  return typeof field === "string" ? field.slice(0, maximumLength) : undefined;
}

export const Route = createFileRoute("/api/client-errors")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const receivedSubmission = await readSubmission(request); // A Cloudflare rule rate limits this route (see `/README.md`).

        if (!receivedSubmission.ok) {
          return receivedSubmission.response;
        }

        const report = receivedSubmission.fields;
        const message = stringField(report, "message", MAX_MESSAGE_LENGTH);
        const route = stringField(report, "route", MAX_ROUTE_LENGTH);

        if (!message || !route?.startsWith("/")) {
          return new Response(null, { status: 400 });
        }

        console.error({
          event: "client_error",
          kind: stringField(report, "kind", MAX_KIND_LENGTH) ?? "unknown",
          message,
          route,
          stack: stringField(report, "stack", MAX_STACK_LENGTH),
        });

        return new Response(null, { status: 204 });
      },
    },
  },
});
