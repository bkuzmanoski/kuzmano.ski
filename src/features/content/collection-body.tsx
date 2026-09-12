import { useWindowContent } from "#/lib/window-manager/context.ts";
import type { CollectionTarget } from "#/site/windows.ts";
import { resolveWindow } from "#/site/windows.ts";

import { CollectionEntryList } from "./collection-entry-list.tsx";

function useOpenEntrySlug(collectionRoute: string): string | null {
  const entryWindow = useWindowContent().entry;
  const entryTarget = entryWindow ? resolveWindow(entryWindow.route) : null;

  return entryTarget?.id === "entry" && entryTarget.collectionRoute === collectionRoute ? entryTarget.slug : null;
}

export function CollectionBody({ target }: { target: CollectionTarget }) {
  const activeSlug = useOpenEntrySlug(target.collectionRoute);
  return <CollectionEntryList activeSlug={activeSlug} collection={target.collection} />;
}
