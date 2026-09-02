import { createFileRoute } from "@tanstack/react-router";

import { parseSubmission } from "#/lib/waitlist/membership";
import { WAITLIST_RATELIMIT_BINDING } from "#/server/bindings";
import { readSubmission, refusalFor } from "#/server/endpoint";
import { recordMembership } from "#/server/waitlist";
import type { MembershipResult } from "#/server/waitlist";

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
