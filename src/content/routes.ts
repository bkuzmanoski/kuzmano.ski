import { notFound } from "@tanstack/react-router";

import type { Collection, ContentEntry, Frontmatter } from "./index";

const SITE = "kuzmano.ski";

/**
 * Route options shared by every collection's index. The list markup stays in the
 * route file: it needs a statically typed `to`, and each collection will want to
 * surface different fields anyway.
 */
export function indexRoute(collection: Collection, title: string) {
  return {
    loader: (): Promise<Array<ContentEntry>> => collection.list(),
    head: () => ({ meta: [{ title: `${title}—${SITE}` }] }),
  };
}

/**
 * Route options shared by every collection's post route. Fully generic—the
 * body is rendered by `<Post>`, which is identical across collections.
 */
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
        ? [{ title: `${loaderData.title}—${SITE}` }, { name: "description", content: loaderData.description }]
        : [],
    }),
  };
}
