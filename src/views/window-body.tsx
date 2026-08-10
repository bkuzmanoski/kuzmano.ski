import { Suspense, memo } from "react";

import { EmptyState } from "#/components/empty-state";
import { pages } from "#/content";
import type { Collection } from "#/content";
import { resolveWindow } from "#/content/window-registry";

import { CollectionEntryList } from "./collection-entry-list";
import { ContentBody } from "./content-body";
import { NotFoundBody } from "./not-found";

function CollectionEntryBody({ collection, slug }: { collection: Collection; slug: string }) {
  const frontmatter = collection.frontmatter(slug);
  return frontmatter ? <ContentBody content={collection.load(slug)} frontmatter={frontmatter} /> : null;
}

function PageBody({ slug }: { slug: string }) {
  const frontmatter = pages.frontmatter(slug);
  return frontmatter ? <ContentBody content={pages.load(slug)} frontmatter={frontmatter} showDate={false} /> : null;
}

function Pane({ route }: { route: string }) {
  const target = resolveWindow(route);

  if (!target) {
    return null;
  }

  switch (target.id) {
    case "collection":
      // A collection window opens on an entry (see `windowRouteFor`) so the list is empty here.
      return target.entrySlug === null ? (
        <EmptyState message="This collection has no entries." />
      ) : (
        <CollectionEntryBody collection={target.collection} slug={target.entrySlug} />
      );
    case "page":
      return <PageBody slug={target.slug} />;
    case "notFound":
      return <NotFoundBody />;
  }
}

/* Both `WindowSidebar` and `WindowBody` depend on the route alone, so they
 * are memoized and held apart from the geometry. */

/** The sidebar of a window. Only the collection window has one (see `hasSidebar`). */
export const WindowSidebar = memo(function Sidebar({ route }: { route: string }) {
  const target = resolveWindow(route);

  if (target?.id !== "collection") {
    return null;
  }

  /* Keyed by collection so a move to another one starts its list over, rather than
   * carrying the scroll position and the tab stop of the list it replaced. */
  return (
    <CollectionEntryList
      key={target.basePath}
      activeSlug={target.entrySlug}
      basePath={target.basePath}
      collection={target.collection}
    />
  );
});

/** The main pane of a window. */
export const WindowBody = memo(function Body({ route }: { route: string }) {
  return (
    <Suspense fallback={null}>
      <Pane route={route} />
    </Suspense>
  );
});
