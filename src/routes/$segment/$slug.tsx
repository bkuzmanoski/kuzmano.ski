import { createFileRoute } from "@tanstack/react-router";

import { contentRoute } from "#/site/route-data.ts";

export const Route = createFileRoute("/$segment/$slug")({
  ...contentRoute,
  component: () => null,
});
