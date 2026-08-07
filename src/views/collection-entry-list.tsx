import clsx from "clsx";

import type { Collection } from "#/content";
import { playClick } from "#/lib/audio/ui";
import { formatDate } from "#/lib/date";
import { useListNavigation } from "#/lib/hooks/use-list-navigation";
import { useWindowActions } from "#/lib/window-manager";

import styles from "./collection-entry-list.module.css";

const DATE_FORMAT = new Intl.DateTimeFormat("en-AU", { year: "numeric", month: "short", day: "numeric" });

/** The entries of a collection, as the list half of the collection window. */
export function CollectionEntryList({
  collection,
  basePath,
  activeSlug,
}: {
  collection: Collection;
  basePath: string;
  activeSlug: string | null;
}) {
  const { open } = useWindowActions();

  const entries = collection.list();
  const openEntry = (slug: string) => open(`${basePath}/${slug}`);

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

  return (
    <ul className={styles.list}>
      {entries.map((entry, index) => {
        const isActive = entry.slug === activeSlug;

        return (
          <li key={entry.slug}>
            <a
              {...itemProps(index)}
              aria-current={isActive || undefined}
              aria-label={entry.title}
              className={clsx(styles.card, isActive && styles.active)}
              href={`${basePath}/${entry.slug}`}
              onClick={(event) => {
                event.preventDefault();
                openEntry(entry.slug);
              }}
              onPointerDown={playClick}
            >
              <span className={styles.title}>{entry.title}</span>
              <span className={styles.description}>{entry.description}</span>
              <span className={styles.meta}>
                {entry.category && <span>{entry.category}</span>}
                <time dateTime={entry.date}>{formatDate(entry.date, DATE_FORMAT)}</time>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
