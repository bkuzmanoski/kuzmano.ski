import { notFound } from "@tanstack/react-router";

import { documentTitle } from "#/config/site";

import { collections, pages } from "./index";

import type { Frontmatter } from "./index";

const documentHead = ({ loaderData }: { loaderData?: { title: string; description?: string } }) => ({
  meta: loaderData
    ? [
        { title: documentTitle(loaderData.title) },
        ...(loaderData.description ? [{ name: "description", content: loaderData.description }] : []),
      ]
    : [],
});

function documentData(frontmatter: Frontmatter | null | undefined) {
  if (!frontmatter) {
    throw notFound();
  }

  return { title: frontmatter.title, description: frontmatter.description };
}

export const contentRoute = {
  loader: ({ params }: { params: { segment: string; slug?: string } }): { title: string; description?: string } => {
    if (params.slug !== undefined) {
      return documentData(collections[params.segment]?.frontmatterOf(params.slug));
    }

    const collection = collections[params.segment];

    if (collection) {
      return { title: collection.title };
    }

    return documentData(pages.frontmatterOf(params.segment));
  },
  head: documentHead,
};
