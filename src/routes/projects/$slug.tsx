import { createFileRoute } from "@tanstack/react-router";

import { projects } from "#/content";
import { postRoute } from "#/content/routes";
import { Post } from "#/ui/post";

export const Route = createFileRoute("/projects/$slug")({
  ...postRoute(projects),
  component: Project,
});

function Project() {
  return <Post collection={projects} frontmatter={Route.useLoaderData()} slug={Route.useParams().slug} />;
}
