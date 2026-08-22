import { createFileRoute } from "@tanstack/react-router";

import { isRecord } from "#/lib/guards";
import { isOversized, isSameOrigin } from "#/server/request";

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
        if (!isSameOrigin(request)) {
          return new Response(null, { status: 403 });
        }

        if (isOversized(request)) {
          return new Response(null, { status: 413 });
        }

        const body = await request.text();

        if (isOversized(body)) {
          return new Response(null, { status: 413 });
        }

        let report: unknown;

        try {
          report = JSON.parse(body);
        } catch {
          return new Response(null, { status: 400 });
        }

        if (!isRecord(report)) {
          return new Response(null, { status: 400 });
        }

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
