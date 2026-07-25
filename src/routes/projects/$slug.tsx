import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { projects } from "#/content";
import { postRoute } from "#/content/routes";
import { Window } from "#/ui/window";
import { Post } from "#/views/post";

export const Route = createFileRoute("/projects/$slug")({
  ...postRoute(projects),
  component: Project,
});

function Project() {
  const { slug } = Route.useParams();
  const frontmatter = Route.useLoaderData();
  const navigate = useNavigate();

  return (
    <Window id={`projects/${slug}`} title={frontmatter.title} onClose={() => navigate({ to: "/projects" })}>
      <Post collection={projects} frontmatter={frontmatter} slug={slug} />
    </Window>
  );
}
