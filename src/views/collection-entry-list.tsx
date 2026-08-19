import { EmptyState } from "#/components/empty-state";
import type { Collection } from "#/content";
import { playClick, scrollSafeClickSoundHandlers } from "#/lib/audio/ui";
import { cx } from "#/lib/class-names";
import { formatDate } from "#/lib/date";
import { useListNavigation } from "#/lib/hooks/use-list-navigation";
import { isBrowserHandledClick } from "#/lib/link";
import { useWindowActions } from "#/lib/window-manager";

import styles from "./collection-entry-list.module.css";

const DATE_FORMAT = new Intl.DateTimeFormat("en-AU", { year: "numeric", month: "short", day: "numeric" });

export const EMPTY_COLLECTION_MESSAGE = "Nothing to see here.";

export function CollectionEntryList({
  collection,
  route,
  activeSlug,
}: {
  collection: Collection;
  route: string;
  activeSlug: string | null;
}) {
  const { open } = useWindowActions();

  const entries = collection.list();
  const openEntry = (slug: string) => open(`${route}/${slug}`);

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
              {...itemProps(index)}
              {...scrollSafeClickSoundHandlers}
              aria-current={isActive || undefined}
              aria-label={entry.title}
              className={cx(styles.card, isActive && styles.active)}
              href={`${route}/${entry.slug}`}
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
                <time dateTime={entry.date}>{formatDate(entry.date, DATE_FORMAT)}</time>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
