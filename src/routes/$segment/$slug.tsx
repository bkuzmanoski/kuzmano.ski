import { createFileRoute } from "@tanstack/react-router";

import { contentRoute } from "#/content/routes";

export const Route = createFileRoute("/$segment/$slug")({
  ...contentRoute,
  component: () => null,
});
