import { notFound } from "@tanstack/react-router";
import { ENTRY_COVER_IMAGES } from "virtual:entry-cover-images";

import displayFontUrl from "#/assets/fonts/BricolageGrotesque-Variable.woff2?url";
import bitmapFontUrl from "#/assets/fonts/Silkscreen.woff2?url";
import bodyFontUrl from "#/assets/fonts/SourceSerif4-Variable.woff2?url";

import { pages } from "./catalog.ts";
import { collectionFeed } from "./feeds.ts";
import { documentHead, fontPreloadLinkFor } from "./metadata.ts";
import { resolveContent } from "./resolve-content.ts";
import { collectionRoute, entryRoute, isDeclaredPageSlug, pageRoute } from "./routes.ts";

import type { Frontmatter } from "./catalog.ts";
import type { DocumentMetadata } from "./metadata.ts";

// The metadata a content route's head is built from, and whether the head preloads `ENTRY_PRELOADED_FONT_URLS`.
// The loader's data is serialized into the document, so it has the flag rather than the URLs, which are the
// same for every entry.
type ContentRouteData = DocumentMetadata & { preloadsEntryFonts: boolean };

// The fonts a page or a collection entry sets text in on first paint, beyond the chrome face the
// root route preloads.
//
// The body face's italic sets only an `<em>`, which a first paint may not contain, so it is left
// to load on demand.
const ENTRY_PRELOADED_FONT_URLS: ReadonlyArray<string> = [displayFontUrl, bodyFontUrl, bitmapFontUrl];

const hasMarkdownRepresentation = (frontmatter: Frontmatter | null) =>
  frontmatter?.draft !== true || import.meta.env.DEV;

function entryDocumentData(
  frontmatter: Frontmatter | null,
  data: Omit<DocumentMetadata, "title" | "description">,
): ContentRouteData {
  if (!frontmatter) {
    throw notFound();
  }

  return {
    title: frontmatter.title,
    description: frontmatter.description,
    ...data,
    preloadsEntryFonts: true,
  };
}

export function contentHead({ preloadsEntryFonts, ...metadata }: ContentRouteData) {
  const head = documentHead(metadata);
  const fontPreloadLinks = preloadsEntryFonts ? ENTRY_PRELOADED_FONT_URLS.map(fontPreloadLinkFor) : [];

  return { ...head, links: [...head.links, ...fontPreloadLinks] };
}

export const contentRoute = {
  loader: ({ params }: { params: { segment: string; slug?: string } }): ContentRouteData => {
    const content = resolveContent(params.segment, params.slug);
    const feed = collectionFeed(params.segment);

    switch (content.kind) {
      case "page":
        return entryDocumentData(content.frontmatter, {
          path: pageRoute(content.slug),
          bodyChunks: pages.bodyChunksOf(content.slug),
          coverImage: ENTRY_COVER_IMAGES[pages.entryKeyOf(content.slug)] ?? null,
          markdown: hasMarkdownRepresentation(content.frontmatter),
          noindex: content.frontmatter?.draft === true || !isDeclaredPageSlug(content.slug),
        });

      case "collectionEntry":
        return entryDocumentData(content.frontmatter, {
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
          preloadsEntryFonts: false,
        };

      default:
        throw notFound(); // Not found, or a feature route that renders its own head tags.
    }
  },
  head: ({ loaderData }: { loaderData?: ContentRouteData }) => (loaderData ? contentHead(loaderData) : {}),
};
