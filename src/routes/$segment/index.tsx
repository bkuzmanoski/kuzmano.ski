import { createFileRoute } from "@tanstack/react-router";

import { contentRoute } from "#/content/routes";

export const Route = createFileRoute("/$segment/")({
  ...contentRoute,
  component: () => null,
});
