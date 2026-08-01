import { createFileRoute } from "@tanstack/react-router";

import { SITE_NAME } from "#/config/site";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: SITE_NAME }] }),
  component: () => null,
});
