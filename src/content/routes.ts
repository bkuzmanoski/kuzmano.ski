import { notFound } from "@tanstack/react-router";

import { documentHead } from "#/config/site";
import type { DocumentMetadata } from "#/config/site";

import { collections, pages } from "./index";

import type { Frontmatter } from "./index";

function documentData(frontmatter: Frontmatter | null | undefined, path: string, kind: DocumentMetadata["kind"]) {
  if (!frontmatter) {
    throw notFound();
  }

  return { title: frontmatter.title, description: frontmatter.description, path, kind };
}

export const contentRoute = {
  loader: ({ params }: { params: { segment: string; slug?: string } }): DocumentMetadata => {
    if (params.slug !== undefined) {
      const path = `/${params.segment}/${params.slug}`;
      return documentData(collections[params.segment]?.frontmatterOf(params.slug), path, "article");
    }

    const collection = collections[params.segment];

    if (collection) {
      return { title: collection.title, description: collection.description, path: `/${params.segment}` };
    }

    return documentData(pages.frontmatterOf(params.segment), `/${params.segment}`, "website");
  },
  head: ({ loaderData }: { loaderData?: DocumentMetadata }) => (loaderData ? documentHead(loaderData) : {}),
};
