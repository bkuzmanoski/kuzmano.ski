import { Suspense } from "react";

import { LoadingState } from "#/components/loading-state";
import { resolveWindow } from "#/content/window-registry";
import type { CollectionTarget } from "#/content/window-registry";
import { useWindowContent } from "#/lib/window-manager";

import { CollectionEntryList } from "./collection-entry-list";
import { ContentBody } from "./content-body";
import { NotFoundBody } from "./not-found";

function useOpenEntrySlug(collectionRoute: string): string | null {
  const entryWindow = useWindowContent().entry;
  const target = entryWindow ? resolveWindow(entryWindow.route) : null;

  return target?.id === "entry" && target.collectionRoute === collectionRoute ? target.slug : null;
}

function CollectionListBody({ target }: { target: CollectionTarget }) {
  const activeSlug = useOpenEntrySlug(target.route);
  return <CollectionEntryList activeSlug={activeSlug} collection={target.collection} route={target.route} />;
}

export function WindowBody({ route }: { route: string }) {
  const target = resolveWindow(route);

  if (!target) {
    return null;
  }

  switch (target.id) {
    case "entry":
      return (
        <Suspense fallback={<LoadingState />}>
          <ContentBody content={target.contentIndex.load(target.slug)} />
        </Suspense>
      );

    case "collection":
      return <CollectionListBody target={target} />;

    case "notFound":
      return <NotFoundBody />;
  }
}
