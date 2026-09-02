import { createFileRoute } from "@tanstack/react-router";

import { contentRoute } from "#/site/route-data";

export const Route = createFileRoute("/$segment/")({
  ...contentRoute,
  component: () => null,
});
