import { notFound } from "@tanstack/react-router";

import { collectionFeed } from "#/feeds";
import { documentHead } from "#/metadata";
import type { DocumentMetadata } from "#/metadata";

import { collections, pages } from "./index";

import type { Frontmatter } from "./index";

function documentData(
  frontmatter: Frontmatter | null | undefined,
  data: Omit<DocumentMetadata, "title" | "description">,
): DocumentMetadata {
  if (!frontmatter) {
    throw notFound();
  }

  return { title: frontmatter.title, description: frontmatter.description, ...data };
}

export const contentRoute = {
  loader: ({ params }: { params: { segment: string; slug?: string } }): DocumentMetadata => {
    const collection = collections[params.segment];
    const feed = collectionFeed(params.segment);

    if (params.slug !== undefined) {
      return documentData(collection?.frontmatterOf(params.slug), {
        path: `/${params.segment}/${params.slug}`,
        kind: "article",
        contentAsset: collection?.assetOf(params.slug) ?? null,
        markdown: true,
        feed,
      });
    }

    if (collection) {
      return {
        title: collection.title,
        description: collection.description,
        path: `/${params.segment}`,
        markdown: true,
        feed,
      };
    }

    return documentData(pages.frontmatterOf(params.segment), {
      path: `/${params.segment}`,
      contentAsset: pages.assetOf(params.segment),
      markdown: true,
    });
  },
  head: ({ loaderData }: { loaderData?: DocumentMetadata }) => (loaderData ? documentHead(loaderData) : {}),
};
