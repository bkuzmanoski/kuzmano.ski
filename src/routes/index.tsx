import { createFileRoute } from "@tanstack/react-router";

import { SITE_DESCRIPTION, SITE_NAME } from "#/config/site";
import { documentHead } from "#/metadata";

export const Route = createFileRoute("/")({
  head: () => documentHead({ title: SITE_NAME, description: SITE_DESCRIPTION, path: "/" }),
  component: () => null,
});
