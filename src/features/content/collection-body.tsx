import { useId, useRef } from "react";

import DocumentActiveCollectionBodyIcon from "#/assets/images/collection-body-icon-document-active.svg?react";
import DocumentCollectionBodyIcon from "#/assets/images/collection-body-icon-document.svg?react";
import { EmptyState } from "#/components/empty-state.tsx";
import { ENTRY_DATE_FORMAT } from "#/config/content.ts";
import { playClickSound } from "#/lib/audio/sounds.ts";
import { usePressSoundPlayer } from "#/lib/audio/use-press-sound.ts";
import { cx } from "#/lib/class-names.ts";
import { useListNavigation } from "#/lib/hooks/use-list-navigation.ts";
import { PRESERVE_FOCUS_PROPS } from "#/lib/hooks/use-restorable-focus.ts";
import { useDateFormat } from "#/lib/locale/use-date-format.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import { useDoublePressLink } from "#/lib/press/use-double-press-link.ts";
import { useWindowActions, useWindowContent } from "#/lib/window-manager/context.ts";
import { useWindowKeyDown } from "#/lib/window-manager/use-window-key-down.ts";
import type { Collection, Entry } from "#/site/catalog.ts";
import type { CollectionTarget } from "#/site/windows.ts";
import { resolveWindow } from "#/site/windows.ts";

import styles from "./collection-body.module.css";
import { FormattedDate } from "./formatted-date.tsx";

import type { ComponentProps } from "react";

export const UNCATEGORIZED_LABEL = "Uncategorized";
export const EMPTY_COLLECTION_MESSAGE = "There are no entries in this collection.";

export function CollectionColumnHeadings({ collection }: { collection: Collection }) {
  if (collection.list().length === 0) {
    return null;
  }

  return (
    <div className={styles.columnHeadings} aria-hidden="true" {...PRESERVE_FOCUS_PROPS}>
      <div className={styles.columnHeadingsRow}>
        <span className={styles.titleColumn}>Title</span>
        <span className={styles.categoryColumn}>Category</span>
        <span className={styles.dateColumn}>Date</span>
      </div>
    </div>
  );
}

function CollectionEntryRow({
  entry,
  href,
  isActive,
  dateFormat,
  itemProps,
  onOpen,
}: {
  entry: Entry;
  href: string;
  isActive: boolean;
  dateFormat: Intl.DateTimeFormat;
  itemProps: ComponentProps<"a">;
  onOpen: () => void;
}) {
  const entryId = useId();
  const { handlers: pressSoundHandlers, playPendingTouchPressSound } = usePressSoundPlayer({
    defersTouchPressSound: true,
  });

  const descriptionIds = [entry.category !== undefined ? `${entryId}-category` : null, `${entryId}-date`];
  const Icon = isActive ? DocumentActiveCollectionBodyIcon : DocumentCollectionBodyIcon;

  const doublePressLinkHandlers = useDoublePressLink({
    onOpen: () => {
      playPendingTouchPressSound();
      onOpen();
    },
  });

  return (
    <li>
      <a
        href={href}
        className={styles.listItem}
        aria-labelledby={`${entryId}-title`}
        aria-describedby={descriptionIds.filter((id) => id !== null).join(" ")}
        aria-current={isActive || undefined}
        {...mergeHandlers(
          mergeHandlers(pressSoundHandlers, doublePressLinkHandlers), // Merged before `itemProps` so `useListNavigation` skips modified or non-primary presses when `useDoublePressLink` prevents their `mousedown` default.
          itemProps,
        )}
      >
        <span
          className={styles.titleColumn}
          aria-hidden="true" // The link's name and description reference the cells, which are otherwise hidden so that a screen reader treats the link as one element.
        >
          <Icon className={styles.icon} />
          <span id={`${entryId}-title`} className={styles.title}>
            {entry.title}
          </span>
        </span>
        <span
          id={`${entryId}-category`}
          className={cx(styles.categoryColumn, entry.category === undefined && styles.uncategorized)}
          aria-hidden="true"
        >
          {entry.category ?? UNCATEGORIZED_LABEL}
        </span>
        <FormattedDate
          id={`${entryId}-date`}
          date={entry.date}
          format={dateFormat}
          className={styles.dateColumn}
          aria-hidden="true"
        />
      </a>
    </li>
  );
}

function useOpenEntrySlug(collection: Collection): string | null {
  const entryWindow = useWindowContent().entry;
  const entryTarget = entryWindow ? resolveWindow(entryWindow.route) : null;

  return entryTarget?.id === "entry" && entryTarget.collection?.route === collection.route ? entryTarget.slug : null;
}

export function CollectionBody({ target: { collection } }: { target: CollectionTarget }) {
  const activeSlug = useOpenEntrySlug(collection);
  const { open } = useWindowActions();
  const dateFormat = useDateFormat(ENTRY_DATE_FORMAT);
  const listRef = useRef<HTMLUListElement>(null);

  const entries = collection.list();

  const openEntry = (slug: string) => open(collection.routeOf(slug));

  const { itemProps, onKeyDownOutsideList } = useListNavigation(listRef, {
    count: entries.length,
    activeIndex: entries.findIndex((entry) => entry.slug === activeSlug),
    onActivate: (index) => {
      const entry = entries[index];

      if (entry) {
        playClickSound();
        openEntry(entry.slug);
      }
    },
  });

  // The list is the window's content, so a key that moves the focus into it replaces the scroll the window would
  // otherwise make for that key.
  useWindowKeyDown(onKeyDownOutsideList);

  if (entries.length === 0) {
    return <EmptyState message={EMPTY_COLLECTION_MESSAGE} />;
  }

  return (
    <div className={styles.listView}>
      <ul
        ref={listRef}
        className={styles.list}
        role="list" // The explicit role is required because Safari removes the list role of a `<ul>` without list markers.
      >
        {entries.map((entry, index) => (
          <CollectionEntryRow
            key={entry.slug}
            entry={entry}
            href={collection.routeOf(entry.slug)}
            isActive={entry.slug === activeSlug}
            dateFormat={dateFormat}
            itemProps={itemProps(index)}
            onOpen={() => openEntry(entry.slug)}
          />
        ))}
      </ul>
    </div>
  );
}
