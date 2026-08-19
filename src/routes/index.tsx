import { createFileRoute } from "@tanstack/react-router";

import { SITE_DESCRIPTION, SITE_NAME, documentHead } from "#/config/site";

export const Route = createFileRoute("/")({
  head: () => documentHead({ title: SITE_NAME, description: SITE_DESCRIPTION, path: "/" }),
  component: () => null,
});
