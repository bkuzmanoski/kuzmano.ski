import { createFileRoute } from "@tanstack/react-router";

import { parseSubmission } from "#/lib/waitlist/membership.ts";
import { WAITLIST_RATELIMIT_BINDING } from "#/server/bindings.ts";
import { readSubmission, refusalFor } from "#/server/endpoint.ts";
import { recordMembership } from "#/server/waitlist.ts";
import type { MembershipResult } from "#/server/waitlist.ts";

const MEMBERSHIP_STATUS: Record<MembershipResult, number> = {
  recorded: 204,
  throttled: 429,
  unavailable: 502,
};

export const Route = createFileRoute("/api/waitlist")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const receivedSubmission = await readSubmission(request, WAITLIST_RATELIMIT_BINDING);

        if (!receivedSubmission.ok) {
          return receivedSubmission.response;
        }

        const parsedSubmission = parseSubmission(receivedSubmission.fields);

        if (!parsedSubmission.ok) {
          return refusalFor(parsedSubmission);
        }

        return new Response(null, { status: MEMBERSHIP_STATUS[await recordMembership(parsedSubmission.value)] });
      },
    },
  },
});
