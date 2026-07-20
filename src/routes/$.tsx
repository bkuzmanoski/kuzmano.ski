import { createFileRoute } from "@tanstack/react-router";

import { NotFound } from "#/ui/not-found";

/**
 * Catch-all for paths the client router is asked to resolve but does not
 * recognise—an in-app navigation to a dead link.
 *
 * Direct hits on a bad URL never reach this: Cloudflare answers those with the
 * static 404.html before the app loads. A splat rather than the root's
 * `notFoundComponent` so the page owns a `head` and gets its own title.
 *
 * Not listed in `pages`, so it is never prerendered to a page of its own.
 */
export const Route = createFileRoute("/$")({
  head: () => ({ meta: [{ title: "Not found—kuzmano.ski" }] }),
  component: NotFound,
});
