import { notFound } from "@tanstack/react-router";

import { PAGE_SLUGS } from "#/config/content.ts";

import { pages } from "./catalog.ts";
import { collectionRoute, entryRoute, pageRoute } from "./content-routes.ts";
import { collectionFeed } from "./feeds.ts";
import { documentHead } from "./metadata.ts";
import { resolveContent } from "./resolve-content.ts";

import type { Frontmatter } from "./catalog.ts";
import type { DocumentMetadata } from "./metadata.ts";

const isRegisteredPage = (slug: string) => (PAGE_SLUGS as ReadonlyArray<string>).includes(slug);
const hasMarkdownAlternate = (frontmatter: Frontmatter | null) => frontmatter?.draft !== true || import.meta.env.DEV;

function documentData(
  frontmatter: Frontmatter | null,
  data: Omit<DocumentMetadata, "title" | "description">,
): DocumentMetadata {
  if (!frontmatter) {
    throw notFound();
  }

  return { title: frontmatter.title, description: frontmatter.description, ...data };
}

export const contentRoute = {
  loader: ({ params }: { params: { segment: string; slug?: string } }): DocumentMetadata => {
    const content = resolveContent(params.segment, params.slug);
    const feed = collectionFeed(params.segment);

    switch (content.kind) {
      case "page":
        return documentData(content.frontmatter, {
          path: pageRoute(content.slug),
          contentAsset: pages.assetOf(content.slug),
          markdown: hasMarkdownAlternate(content.frontmatter),
          noindex: content.frontmatter?.draft === true || !isRegisteredPage(content.slug),
        });

      case "collectionEntry":
        return documentData(content.frontmatter, {
          path: entryRoute(params.segment, content.slug),
          kind: "article",
          contentAsset: content.collection.assetOf(content.slug),
          markdown: hasMarkdownAlternate(content.frontmatter),
          feed,
          noindex: content.frontmatter?.draft === true,
        });

      case "collection":
        return {
          title: content.collection.title,
          description: content.collection.description,
          path: collectionRoute(params.segment),
          markdown: true,
          feed,
        };

      default:
        throw notFound(); // Not found, or a reserved route that renders its own head tags.
    }
  },
  head: ({ loaderData }: { loaderData?: DocumentMetadata }) => (loaderData ? documentHead(loaderData) : {}),
};
