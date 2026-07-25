import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { writing } from "#/content";
import { postRoute } from "#/content/routes";
import { Window } from "#/ui/window";
import { Post } from "#/views/post";

export const Route = createFileRoute("/writing/$slug")({
  ...postRoute(writing),
  component: WritingPost,
});

function WritingPost() {
  const { slug } = Route.useParams();
  const frontmatter = Route.useLoaderData();
  const navigate = useNavigate();

  return (
    <Window id={`writing/${slug}`} title={frontmatter.title} onClose={() => navigate({ to: "/writing" })}>
      <Post collection={writing} frontmatter={frontmatter} slug={slug} />
    </Window>
  );
}
