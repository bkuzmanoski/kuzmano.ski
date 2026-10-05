import { useWindowContent } from "#/lib/window-manager/context.ts";
import type { Collection } from "#/site/catalog.ts";
import type { CollectionTarget } from "#/site/windows.ts";
import { resolveWindow } from "#/site/windows.ts";

import { CollectionEntryList } from "./collection-entry-list.tsx";

function useOpenEntrySlug(collection: Collection): string | null {
  const entryWindow = useWindowContent().entry;
  const entryTarget = entryWindow ? resolveWindow(entryWindow.route) : null;

  return entryTarget?.id === "entry" && entryTarget.collection?.route === collection.route ? entryTarget.slug : null;
}

export function CollectionBody({ target: { collection } }: { target: CollectionTarget }) {
  const activeSlug = useOpenEntrySlug(collection);
  return <CollectionEntryList activeSlug={activeSlug} collection={collection} />;
}
