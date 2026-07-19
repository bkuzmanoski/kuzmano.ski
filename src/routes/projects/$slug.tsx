import { MDXProvider } from "@mdx-js/react";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { projects } from "#/content";
import { mdxComponents } from "#/ui/mdx-components";

export const Route = createFileRoute("/projects/$slug")({
  loader: async ({ params }) => {
    const frontmatter = await projects.load(params.slug);

    if (!frontmatter) {
      throw notFound();
    }

    return frontmatter;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [{ title: `${loaderData.title} — kuzmano.ski` }, { name: "description", content: loaderData.description }]
      : [],
  }),
  component: Project,
});

function Project() {
  const { slug } = Route.useParams();
  const frontmatter = Route.useLoaderData();
  const Content = projects.component(slug);

  return (
    <main>
      <h1>{frontmatter.title}</h1>
      <MDXProvider components={mdxComponents}>
        <Content />
      </MDXProvider>
    </main>
  );
}
