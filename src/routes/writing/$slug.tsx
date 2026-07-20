import { createFileRoute } from "@tanstack/react-router";

import { writing } from "#/content";
import { postRoute } from "#/content/routes";
import { Post } from "#/ui/post";

export const Route = createFileRoute("/writing/$slug")({
  ...postRoute(writing),
  component: WritingPost,
});

function WritingPost() {
  return <Post collection={writing} frontmatter={Route.useLoaderData()} showDate slug={Route.useParams().slug} />;
}
