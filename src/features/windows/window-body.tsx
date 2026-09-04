import { Suspense } from "react";

import { Spinner } from "#/components/spinner.tsx";
import { ContactBody } from "#/features/contact/contact-body.tsx";
import { CollectionBody } from "#/features/content/collection-body.tsx";
import { ContentBody } from "#/features/content/content-body.tsx";
import { resolveWindow } from "#/site/windows.ts";

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
