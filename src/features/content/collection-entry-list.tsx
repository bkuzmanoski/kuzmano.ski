import { useRef } from "react";

import DocumentDesktopIcon from "#/assets/images/desktop-icon-document.svg?react";
import { EmptyState } from "#/components/empty-state.tsx";
import { ENTRY_DATE_FORMAT } from "#/config/content.ts";
import { playClick } from "#/lib/audio/sounds.ts";
import { usePressSound } from "#/lib/audio/use-press-sound.ts";
import { cx } from "#/lib/class-names.ts";
import { useEntryCoverImage } from "#/lib/content/entry-cover-images.ts";
import type { EntryKey } from "#/lib/content/entry-file.ts";
import { formatDate } from "#/lib/datetime.ts";
import { useDateFormat } from "#/lib/hooks/use-date-format.ts";
import { useListNavigation } from "#/lib/hooks/use-list-navigation.ts";
import { isBrowserHandledClick, openInAppOnPlainClick } from "#/lib/link.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import { useWindowActions } from "#/lib/window-manager/context.ts";
import { useWindowKeyDown } from "#/lib/window-manager/use-window-key-down.ts";
import type { Collection } from "#/site/catalog.ts";
import { languageAttributeInDocumentFor } from "#/site/language.ts";

import styles from "./collection-entry-list.module.css";

import type { MouseEvent } from "react";

export const EMPTY_COLLECTION_MESSAGE = "There are no entries in this collection.";

function EntryCoverImage({ entryKey }: { entryKey: EntryKey }) {
  const coverImage = useEntryCoverImage(entryKey);

  if (!coverImage) {
    return (
      <span className={styles.coverImage}>
        <DocumentDesktopIcon className={styles.documentDesktopIcon} />
      </span>
    );
  }

  const { thumbnail } = coverImage;

  return (
    <span className={styles.coverImage}>
      <picture>
        {thumbnail.alternates.map(({ srcSet, type }) => (
          <source key={type} srcSet={srcSet} type={type} />
        ))}
        <img
          src={thumbnail.src}
          alt=""
          width={thumbnail.width}
          height={thumbnail.height}
          loading="lazy"
          decoding="async"
        />
      </picture>
    </span>
  );
}

export function CollectionEntryList({ collection, activeSlug }: { collection: Collection; activeSlug: string | null }) {
  const { open } = useWindowActions();
  const dateFormat = useDateFormat(ENTRY_DATE_FORMAT);
  const dateLanguage = languageAttributeInDocumentFor(dateFormat); // The dates are formatted in the browser's locale.
  const pressSoundHandlers = usePressSound({ scrollSafe: true });
  const listRef = useRef<HTMLUListElement>(null);

  const entries = collection.list();
  const openEntry = (slug: string) => open(collection.routeOf(slug));

  const { itemProps, onKeyDownOutsideList } = useListNavigation(listRef, {
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

  // The list is the window's content, so a key that moves the focus into it replaces the scroll
  // the window would otherwise make for that key.
  useWindowKeyDown(onKeyDownOutsideList);

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
          onClick: (event: MouseEvent<HTMLAnchorElement>) => openInAppOnPlainClick(event, () => openEntry(entry.slug)),
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
              <EntryCoverImage entryKey={collection.entryKeyOf(entry.slug)} />
              <span className={styles.details}>
                <span className={styles.title}>{entry.title}</span>
                <time dateTime={entry.date} className={styles.date} lang={dateLanguage}>
                  {formatDate(entry.date, dateFormat)}
                </time>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
