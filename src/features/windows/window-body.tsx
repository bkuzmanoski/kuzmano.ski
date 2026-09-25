import { Suspense } from "react";

import { LoadingIndicator } from "#/components/loading-indicator.tsx";
import { ContactBody } from "#/features/contact/contact-body.tsx";
import { CollectionBody } from "#/features/content/collection-body.tsx";
import { ContentBody } from "#/features/content/content-body.tsx";
import { resolveWindow } from "#/site/windows.ts";

import styles from "./window-body.module.css";

export function WindowBody({ route }: { route: string }) {
  const target = resolveWindow(route);

  if (!target) {
    return null;
  }

  const hiddenTitle = <h1 className={styles.title}>{target.title}</h1>;

  switch (target.id) {
    case "entry":
      return (
        <Suspense fallback={<LoadingIndicator layout="fill" />}>
          <ContentBody route={route} title={target.title} content={target.contentIndex.load(target.slug)} />
        </Suspense>
      );

    case "collection":
      return (
        <>
          {hiddenTitle}
          <CollectionBody target={target} />
        </>
      );

    case "contact":
      return (
        <>
          {hiddenTitle}
          <ContactBody />
        </>
      );
  }
}
