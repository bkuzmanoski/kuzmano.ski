import { MDXProvider } from "@mdx-js/react";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { writing } from "#/content";
import { mdxComponents } from "#/ui/mdx-components";

export const Route = createFileRoute("/writing/$slug")({
  loader: async ({ params }) => {
    const frontmatter = await writing.load(params.slug);
    if (!frontmatter) throw notFound();

    return frontmatter;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [{ title: `${loaderData.title} — kuzmano.ski` }, { name: "description", content: loaderData.description }]
      : [],
  }),
  component: WritingPost,
});

function WritingPost() {
  const { slug } = Route.useParams();
  const frontmatter = Route.useLoaderData();
  const Content = writing.component(slug);

  return (
    <main>
      <h1>{frontmatter.title}</h1>
      <time dateTime={frontmatter.date}>{frontmatter.date}</time>
      <MDXProvider components={mdxComponents}>
        <Content />
      </MDXProvider>
    </main>
  );
}
