import { notFound } from "@tanstack/react-router";

import type { Collection, ContentEntry, Frontmatter } from "./index";

export function indexRoute(collection: Collection, title: string) {
  return {
    loader: (): Promise<Array<ContentEntry>> => collection.list(),
    head: () => ({ meta: [{ title: `${title}—kuzmano.ski` }] }),
  };
}

export function postRoute(collection: Collection) {
  return {
    loader: async ({ params }: { params: { slug: string } }): Promise<Frontmatter> => {
      const frontmatter = await collection.frontmatter(params.slug);

      if (!frontmatter) {
        throw notFound();
      }

      return frontmatter;
    },
    head: ({ loaderData }: { loaderData?: Frontmatter }) => ({
      meta: loaderData
        ? [{ title: `${loaderData.title}—kuzmano.ski` }, { name: "description", content: loaderData.description }]
        : [],
    }),
  };
}
