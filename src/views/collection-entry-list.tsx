import { EmptyState } from "#/components/empty-state";
import { ENTRY_DATE_FORMAT } from "#/config/content";
import type { Collection } from "#/content";
import { resolveWindow } from "#/content/window-registry";
import type { CollectionTarget } from "#/content/window-registry";
import { playClick, scrollSafeClickSoundHandlers } from "#/lib/audio/sounds";
import { cx } from "#/lib/class-names";
import { formatDate } from "#/lib/date";
import { useDateFormat } from "#/lib/hooks/use-date-format";
import { useListNavigation } from "#/lib/hooks/use-list-navigation";
import { isBrowserHandledClick } from "#/lib/link";
import { mergeHandlers } from "#/lib/merge-handlers";
import { useWindowActions, useWindowContent } from "#/lib/window-manager";

import styles from "./collection-entry-list.module.css";

import type { MouseEvent } from "react";

export const EMPTY_COLLECTION_MESSAGE = "Nothing to see here.";

export function CollectionEntryList({ collection, activeSlug }: { collection: Collection; activeSlug: string | null }) {
  const { open } = useWindowActions();
  const dateFormat = useDateFormat(ENTRY_DATE_FORMAT);

  const entries = collection.list();
  const openEntry = (slug: string) => open(collection.routeOf(slug));

  const itemProps = useListNavigation({
    count: entries.length,
    activeIndex: entries.findIndex((entry) => entry.slug === activeSlug),
    onActivate: (index) => {
      const entry = entries[index];

      if (entry) {
        playClick();
        openEntry(entry.slug);
      }
    },
  });

  if (entries.length === 0) {
    return <EmptyState message={EMPTY_COLLECTION_MESSAGE} />;
  }

  return (
    <ul className={styles.list}>
      {entries.map((entry, index) => {
        const isActive = entry.slug === activeSlug;

        return (
          <li key={entry.slug}>
            <a
              aria-current={isActive || undefined}
              aria-label={entry.title}
              className={cx(styles.card, isActive && styles.active)}
              href={collection.routeOf(entry.slug)}
              {...mergeHandlers(
                {
                  onMouseDown: (event: MouseEvent<HTMLAnchorElement>) => {
                    if (isBrowserHandledClick(event)) {
                      event.preventDefault();
                    }
                  },
                },
                itemProps(index),
              )}
              {...scrollSafeClickSoundHandlers}
              onClick={(event) => {
                if (isBrowserHandledClick(event)) {
                  return;
                }

                event.preventDefault();
                openEntry(entry.slug);
              }}
            >
              <span className={styles.title}>{entry.title}</span>
              <span className={styles.meta}>
                <time dateTime={entry.date}>{formatDate(entry.date, dateFormat)}</time>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

// The entry window is a sibling of the collection window, so the list reads the
// open entry from window state rather than receiving it as a prop.
function useOpenEntrySlug(collectionRoute: string): string | null {
  const entryWindow = useWindowContent().entry;
  const target = entryWindow ? resolveWindow(entryWindow.route) : null;

  return target?.id === "entry" && target.collectionRoute === collectionRoute ? target.slug : null;
}

export function CollectionBody({ target }: { target: CollectionTarget }) {
  const activeSlug = useOpenEntrySlug(target.route);
  return <CollectionEntryList activeSlug={activeSlug} collection={target.collection} />;
}
