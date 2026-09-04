import { useWindowContent } from "#/lib/window-manager/context.ts";
import type { CollectionTarget } from "#/site/windows.ts";
import { resolveWindow } from "#/site/windows.ts";

import { CollectionEntryList } from "./collection-entry-list.tsx";

function useOpenEntrySlug(collectionRoute: string): string | null {
  const entryWindow = useWindowContent().entry;
  const target = entryWindow ? resolveWindow(entryWindow.route) : null;

  return target?.id === "entry" && target.collectionRoute === collectionRoute ? target.slug : null;
}

export function CollectionBody({ target }: { target: CollectionTarget }) {
  const activeSlug = useOpenEntrySlug(target.collectionRoute);
  return <CollectionEntryList activeSlug={activeSlug} collection={target.collection} />;
}
