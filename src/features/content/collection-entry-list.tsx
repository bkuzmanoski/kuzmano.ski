import { useRef } from "react";

import { EmptyState } from "#/components/empty-state.tsx";
import { ENTRY_DATE_FORMAT } from "#/config/content.ts";
import { playClick } from "#/lib/audio/sounds.ts";
import { usePressSound } from "#/lib/audio/use-press-sound.ts";
import { cx } from "#/lib/class-names.ts";
import { formatDate } from "#/lib/date.ts";
import { useDateFormat } from "#/lib/hooks/use-date-format.ts";
import { useListNavigation } from "#/lib/hooks/use-list-navigation.ts";
import { isBrowserHandledClick } from "#/lib/link.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import { useWindowActions } from "#/lib/window-manager/context.ts";
import type { Collection } from "#/site/catalog.ts";

import styles from "./collection-entry-list.module.css";

import type { MouseEvent } from "react";

export const EMPTY_COLLECTION_MESSAGE = "There are no entries in this collection.";

export function CollectionEntryList({ collection, activeSlug }: { collection: Collection; activeSlug: string | null }) {
  const { open } = useWindowActions();
  const dateFormat = useDateFormat(ENTRY_DATE_FORMAT);
  const pressSoundHandlers = usePressSound({ scrollSafe: true });
  const listRef = useRef<HTMLUListElement>(null);

  const entries = collection.list();
  const openEntry = (slug: string) => open(collection.routeOf(slug));

  const itemProps = useListNavigation(listRef, {
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
    <ul ref={listRef} className={styles.list}>
      {entries.map((entry, index) => {
        const isActive = entry.slug === activeSlug;

        // Merged ahead of `itemProps` so the opt-out below runs before the list's own
        // press handling, which yields to a press whose default is already prevented.
        const entryEventHandlers = mergeHandlers(pressSoundHandlers, {
          onMouseDown: (event: MouseEvent<HTMLAnchorElement>) => {
            if (isBrowserHandledClick(event)) {
              event.preventDefault();
            }
          },
          onClick: (event: MouseEvent<HTMLAnchorElement>) => {
            if (isBrowserHandledClick(event)) {
              return;
            }

            event.preventDefault();
            openEntry(entry.slug);
          },
        });

        return (
          <li key={entry.slug}>
            <a
              href={collection.routeOf(entry.slug)}
              className={cx(styles.listItem, isActive && styles.active)}
              aria-label={entry.title}
              aria-current={isActive || undefined}
              {...mergeHandlers(entryEventHandlers, itemProps(index))}
            >
              <span className={styles.title}>{entry.title}</span>
              <time dateTime={entry.date} className={styles.date}>
                {formatDate(entry.date, dateFormat)}
              </time>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
