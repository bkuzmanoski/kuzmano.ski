import { createFileRoute } from "@tanstack/react-router";

import { Home } from "#/views/home";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "kuzmano.ski" }] }),
  component: Home,
});
