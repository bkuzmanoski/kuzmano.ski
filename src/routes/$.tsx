import { createFileRoute, notFound } from "@tanstack/react-router";

/** Matches every path that other routes do not. */
export const Route = createFileRoute("/$")({
  loader: () => {
    throw notFound();
  },
  component: () => null,
});
