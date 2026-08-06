import { collections, pages } from "#/content";
import type { Collection } from "#/content";

export type WindowKind = "content" | "collection";

export type WindowTarget =
  | { kind: "collection"; title: string; slug: string; collection: Collection }
  | { kind: "collectionEntry"; title: string; slug: string; collection: Collection }
  | { kind: "page"; title: string; slug: string }
  | { kind: "notFound"; title: string };

const WINDOW_KIND_BY_TARGET: Record<WindowTarget["kind"], WindowKind> = {
  collection: "collection",
  page: "content",
  collectionEntry: "content",
  notFound: "content",
};

export function windowKindFor(target: WindowTarget): WindowKind {
  return WINDOW_KIND_BY_TARGET[target.kind];
}

export function resolveWindow(pathname: string): WindowTarget | null {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  if (segments.length === 1) {
    const slug = segments[0]!;
    const collection = collections[slug];

    if (collection) {
      return { kind: "collection", title: collection.title, slug, collection };
    }

    if (pages.has(slug)) {
      return { kind: "page", title: pages.frontmatter(slug)?.title ?? slug, slug };
    }
  }

  if (segments.length === 2) {
    const collectionSlug = segments[0]!;
    const slug = segments[1]!;
    const collection = collections[collectionSlug];

    if (collection && collection.has(slug)) {
      return { kind: "collectionEntry", title: collection.frontmatter(slug)?.title ?? slug, slug, collection };
    }
  }

  return { kind: "notFound", title: "Page not found (404)" };
}
