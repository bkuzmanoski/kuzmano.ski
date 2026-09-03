import { notFound } from "@tanstack/react-router";

import { PAGE_SLUGS } from "#/config/content";

import { collections, pages } from "./catalog";
import { collectionFeed } from "./feeds";
import { documentHead } from "./metadata";

import type { Frontmatter } from "./catalog";
import type { DocumentMetadata } from "./metadata";

const isRegisteredPage = (slug: string) => (PAGE_SLUGS as ReadonlyArray<string>).includes(slug);
const hasMarkdownAlternate = (frontmatter: Frontmatter | null | undefined) =>
  frontmatter?.draft !== true || import.meta.env.DEV;

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

    if (params.slug) {
      const frontmatter = collection?.frontmatterOf(params.slug);
      return documentData(frontmatter, {
        path: `/${params.segment}/${params.slug}`,
        kind: "article",
        contentAsset: collection?.assetOf(params.slug) ?? null,
        markdown: hasMarkdownAlternate(frontmatter),
        feed,
        noindex: frontmatter?.draft === true,
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

    const frontmatter = pages.frontmatterOf(params.segment);

    return documentData(frontmatter, {
      path: `/${params.segment}`,
      contentAsset: pages.assetOf(params.segment),
      markdown: hasMarkdownAlternate(frontmatter),
      noindex: frontmatter?.draft === true || !isRegisteredPage(params.segment),
    });
  },
  head: ({ loaderData }: { loaderData?: DocumentMetadata }) => (loaderData ? documentHead(loaderData) : {}),
};
