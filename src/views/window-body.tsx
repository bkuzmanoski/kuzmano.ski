import { Suspense } from "react";

import { Spinner } from "#/components/spinner";
import { resolveWindow } from "#/site/windows";

import { CollectionBody } from "./collection-entry-list";
import { ContactBody } from "./contact-body";
import { ContentBody } from "./content-body";

export function WindowBody({ route }: { route: string }) {
  const target = resolveWindow(route);

  if (!target) {
    return null;
  }

  switch (target.id) {
    case "entry":
      return (
        <Suspense fallback={<Spinner layout="fill" />}>
          <ContentBody route={route} title={target.title} content={target.contentIndex.load(target.slug)} />
        </Suspense>
      );

    case "collection":
      return <CollectionBody target={target} />;

    case "contact":
      return <ContactBody />;
  }
}
