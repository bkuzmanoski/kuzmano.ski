import { notFound } from "@tanstack/react-router";

import type { Collection, ContentEntry, Frontmatter } from "./index";

const SITE_NAME = "kuzmano.ski";

export function indexRoute(collection: Collection, title: string) {
  return {
    loader: (): Promise<Array<ContentEntry>> => collection.list(),
    head: () => ({ meta: [{ title: `${title}—${SITE_NAME}` }] }),
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
        ? [{ title: `${loaderData.title}—${SITE_NAME}` }, { name: "description", content: loaderData.description }]
        : [],
    }),
  };
}
