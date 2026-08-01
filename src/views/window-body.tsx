import { pages } from "#/content";
import type { Collection } from "#/content";
import { resolveWindow } from "#/lib/window-registry";

import { ContentBody } from "./content-body";
import { ContentList } from "./content-list";

function CollectionEntryBody({ collection, slug }: { collection: Collection; slug: string }) {
  const frontmatter = collection.frontmatter(slug);
  return frontmatter ? <ContentBody content={collection.load(slug)} frontmatter={frontmatter} /> : null;
}

function PageBody({ slug }: { slug: string }) {
  const frontmatter = pages.frontmatter(slug);
  return frontmatter ? <ContentBody content={pages.load(slug)} frontmatter={frontmatter} showDate={false} /> : null;
}

export function WindowBody({ path }: { path: string }) {
  const windowTarget = resolveWindow(path);

  if (!windowTarget) {
    return null;
  }

  switch (windowTarget.kind) {
    case "collection":
      return <ContentList basePath={path} collection={windowTarget.collection} />;
    case "collectionEntry":
      return <CollectionEntryBody collection={windowTarget.collection} slug={windowTarget.slug} />;
    case "page":
      return <PageBody slug={windowTarget.slug} />;
  }
}
