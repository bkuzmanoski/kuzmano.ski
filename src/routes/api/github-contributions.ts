import { createFileRoute } from "@tanstack/react-router";

import { GITHUB_LOGIN } from "#/config/site.ts";
import { edgeCached } from "#/server/edge-cache.ts";
import { refusalForGet } from "#/server/endpoint.ts";
import { fetchGitHubContributionCalendar } from "#/server/github.ts";

const EDGE_CACHE_LIFETIMES = { successfulResponseSeconds: 3_600, failedResponseSeconds: 300 };

export const Route = createFileRoute("/api/github-contributions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const refusal = await refusalForGet(request);

        if (refusal) {
          return refusal;
        }

        return edgeCached(request, EDGE_CACHE_LIFETIMES, async () => {
          const calendar = await fetchGitHubContributionCalendar(GITHUB_LOGIN);

          return calendar === null ? new Response(null, { status: 502 }) : Response.json(calendar);
        });
      },
    },
  },
});
