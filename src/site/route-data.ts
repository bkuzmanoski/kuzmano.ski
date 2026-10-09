import { notFound } from "@tanstack/react-router";
import { ENTRY_COVER_IMAGES } from "virtual:entry-cover-images";

import displayFontUrl from "#/assets/fonts/Archivo-Variable.woff2?url";
import bitmapFontUrl from "#/assets/fonts/QuantaStrike12-Regular.woff2?url";
import bodyFontUrl from "#/assets/fonts/SourceSerif4-Variable.woff2?url";

import { pages } from "./catalog.ts";
import { collectionFeedOf } from "./feeds.ts";
import { hasMarkdownRepresentation } from "./markdown-negotiation.ts";
import { documentHead, fontPreloadLinkFor } from "./metadata.ts";
import { resolveContent } from "./resolve-content.ts";
import { collectionRoute, entryRoute, isDeclaredPageSlug, pageRoute } from "./routes.ts";

import type { ContentIndex, Frontmatter } from "./catalog.ts";
import type { DocumentMetadata } from "./metadata.ts";

const CONTENT_PRELOADED_FONT_URLS: ReadonlyArray<string> = [displayFontUrl, bodyFontUrl, bitmapFontUrl];

function entryDocumentMetadata(
  frontmatter: Frontmatter | null,
  data: Omit<DocumentMetadata, "title" | "description">,
): DocumentMetadata {
  if (!frontmatter) {
    throw notFound();
  }

  return {
    title: frontmatter.title,
    description: frontmatter.description,
    ...data,
  };
}

async function loadBodyBeforeServerRender(contentIndex: ContentIndex, slug: string) {
  if (import.meta.env.SSR) {
    await contentIndex.load(slug);
  }
}

export function contentHead(metadata: DocumentMetadata) {
  const head = documentHead(metadata);
  return { ...head, links: [...head.links, ...CONTENT_PRELOADED_FONT_URLS.map(fontPreloadLinkFor)] };
}

export const contentRoute = {
  loader: async ({ params }: { params: { segment: string; slug?: string } }): Promise<DocumentMetadata> => {
    const content = resolveContent(params.segment, params.slug);
    const feed = collectionFeedOf(collectionRoute(params.segment));

    switch (content.kind) {
      case "page":
        await loadBodyBeforeServerRender(pages, content.slug);
        return entryDocumentMetadata(content.frontmatter, {
          path: pageRoute(content.slug),
          bodyChunks: pages.bodyChunksOf(content.slug),
          coverImage: ENTRY_COVER_IMAGES[pages.entryKeyOf(content.slug)] ?? null,
          markdown: hasMarkdownRepresentation(content.frontmatter),
          noindex: content.frontmatter?.draft === true || !isDeclaredPageSlug(content.slug),
        });

      case "collectionEntry":
        await loadBodyBeforeServerRender(content.collection, content.slug);
        return entryDocumentMetadata(content.frontmatter, {
          path: entryRoute(params.segment, content.slug),
          kind: "article",
          bodyChunks: content.collection.bodyChunksOf(content.slug),
          coverImage: ENTRY_COVER_IMAGES[content.collection.entryKeyOf(content.slug)] ?? null,
          markdown: hasMarkdownRepresentation(content.frontmatter),
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
        throw notFound(); // Not found, or a feature route that renders its own head tags.
    }
  },
  head: ({ loaderData }: { loaderData?: DocumentMetadata }) => (loaderData ? contentHead(loaderData) : {}),
};
