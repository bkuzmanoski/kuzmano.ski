import { useId, useRef } from "react";

import DocumentOpenCollectionBodyIcon from "#/assets/images/collection-body-icon-document-open.svg?react";
import DocumentCollectionBodyIcon from "#/assets/images/collection-body-icon-document.svg?react";
import { ENTRY_DATE_FORMAT } from "#/config/content.ts";
import { useOpenWindowFrom } from "#/features/window-manager/use-open-window-from.ts";
import { playClickSound } from "#/lib/audio/sounds.ts";
import { cx } from "#/lib/class-names.ts";
import { useActivationFlash } from "#/lib/hooks/use-activation-flash.ts";
import { useListNavigation } from "#/lib/hooks/use-list-navigation.ts";
import { PRESERVE_FOCUS_PROPS } from "#/lib/hooks/use-restorable-focus.ts";
import { useDateFormat } from "#/lib/locale/use-date-format.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import { useDoublePressLink } from "#/lib/press/use-double-press-link.ts";
import { usePressSoundPlayer } from "#/lib/press/use-press-sound.ts";
import type { StyleWithVars } from "#/lib/style.ts";
import { useWindowContent } from "#/lib/window-manager/context.ts";
import { useWindowKeyDown } from "#/lib/window-manager/use-window-key-down.ts";
import type { Collection, Entry } from "#/site/catalog.ts";
import { collectionFeedOf } from "#/site/feeds.ts";
import type { CollectionTarget } from "#/site/windows.ts";
import { resolveWindow } from "#/site/windows.ts";

import styles from "./collection-body.module.css";
import { ContentLink } from "./content-link.tsx";
import { FormattedDate } from "./formatted-date.tsx";
import { OpensInNewTabDescriptionProvider } from "./opens-in-new-tab-description-provider.tsx";

import type { ComponentProps } from "react";

const CATEGORY_COLUMN_HEADING = "Category";

export const UNCATEGORIZED_LABEL = "Uncategorized";

const entryIconStyleOf = (entryIconUrl: string): StyleWithVars => ({
  "--collection-body-entry-icon-image": `url("${entryIconUrl}")`,
});

function categoryColumnLabelsOf(collection: Collection): Array<string> {
  return [
    ...new Set([CATEGORY_COLUMN_HEADING, ...collection.list().map((entry) => entry.category ?? UNCATEGORIZED_LABEL)]),
  ];
}

/**
 * Renders a category label alongside invisible alternatives so every category cell and heading matches the width of the
 * longest label without JavaScript measurement.
 */
function CategoryColumnCell({
  label,
  columnLabels,
  labelId,
  className,
  ...cellProps
}: { label: string; columnLabels: Array<string>; labelId?: string } & ComponentProps<"span">) {
  return (
    <span className={cx(styles.categoryColumn, className)} {...cellProps}>
      <span id={labelId} className={styles.categoryLabel}>
        {label}
      </span>
      <span className={styles.otherCategoryLabels}>
        {columnLabels
          .filter((columnLabel) => columnLabel !== label)
          .map((columnLabel) => (
            <span key={columnLabel}>{columnLabel}</span>
          ))}
      </span>
    </span>
  );
}

export function CollectionColumnHeadings({ collection }: { collection: Collection }) {
  if (collection.list().length === 0) {
    return null;
  }

  return (
    <div className={styles.columnHeadings} aria-hidden="true" {...PRESERVE_FOCUS_PROPS}>
      <div className={styles.columnHeadingsRow}>
        <span className={styles.titleColumn}>Title</span>
        <CategoryColumnCell label={CATEGORY_COLUMN_HEADING} columnLabels={categoryColumnLabelsOf(collection)} />
        <span className={styles.dateColumn}>Date</span>
      </div>
    </div>
  );
}

function CollectionEntryRow({
  entry,
  entryIconUrl,
  href,
  isOpen,
  highlight,
  categoryColumnLabels,
  dateFormat,
  itemProps,
  onOpen,
}: {
  entry: Entry;
  entryIconUrl: string | null;
  href: string;
  isOpen: boolean;
  /** Temporarily overrides the focus highlight during the activation flash; `null` uses the focus state. */
  highlight: boolean | null;
  categoryColumnLabels: Array<string>;
  dateFormat: Intl.DateTimeFormat;
  itemProps: ComponentProps<"a">;
  onOpen: () => void;
}) {
  const entryId = useId();
  const { handlers: pressSoundHandlers, playPendingTouchPressSound } = usePressSoundPlayer({
    defersTouchPressSound: true,
  });
  const doublePressLinkHandlers = useDoublePressLink({
    onOpen: () => {
      playPendingTouchPressSound();
      onOpen();
    },
  });

  const descriptionIds = [entry.category !== undefined ? `${entryId}-category` : null, `${entryId}-date`];

  const DocumentIcon = isOpen ? DocumentOpenCollectionBodyIcon : DocumentCollectionBodyIcon;

  return (
    <li>
      <a
        href={href}
        className={cx(
          styles.listItem,
          highlight === true && styles.highlighted,
          highlight === false && styles.unhighlighted,
        )}
        aria-labelledby={`${entryId}-title`}
        aria-describedby={descriptionIds.filter((id) => id !== null).join(" ")}
        aria-current={isOpen || undefined}
        // `itemProps` comes last so `useListNavigation` skips modified or non-primary presses when `useDoublePressLink`
        // prevents their `mousedown` default.
        {...mergeHandlers(pressSoundHandlers, doublePressLinkHandlers, itemProps)}
      >
        <span
          className={styles.titleColumn}
          aria-hidden="true" // The link's name and description reference the cells, which are otherwise hidden so that a screen reader treats the link as one element.
        >
          {entryIconUrl === null ? (
            <DocumentIcon className={styles.documentIcon} />
          ) : (
            <span className={styles.entryIcon} style={entryIconStyleOf(entryIconUrl)} />
          )}
          <span id={`${entryId}-title`} className={styles.title}>
            {entry.title}
          </span>
        </span>
        <CategoryColumnCell
          label={entry.category ?? UNCATEGORIZED_LABEL}
          columnLabels={categoryColumnLabels}
          labelId={`${entryId}-category`} // Applied to the label as descriptions referenced by `aria-describedby` include hidden descendants.
          className={cx(entry.category === undefined && styles.uncategorized)}
          aria-hidden="true"
        />
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
  const openSlug = useOpenEntrySlug(collection);
  const openWindowFrom = useOpenWindowFrom();
  const dateFormat = useDateFormat(ENTRY_DATE_FORMAT);
  const activationFlash = useActivationFlash<string>();
  const listRef = useRef<HTMLUListElement>(null);

  const entries = collection.list();
  const categoryColumnLabels = categoryColumnLabelsOf(collection);

  function openEntry(index: number) {
    const entry = entries[index];

    if (!entry) {
      return;
    }

    // `getElementsByClassName` matches the generated class name without parsing a selector, so it does not assume the
    // name is selector-safe.
    const title = listRef.current?.children.item(index)?.getElementsByClassName(styles.title!).item(0);

    activationFlash.start(entry.slug);
    openWindowFrom(collection.routeOf(entry.slug), title);
  }

  const { itemProps, onKeyDownOutsideList } = useListNavigation(listRef, {
    count: entries.length,
    currentIndex: entries.findIndex((entry) => entry.slug === openSlug),
    onActivate: (index) => {
      playClickSound();
      openEntry(index);
    },
  });

  // The list is the window's content, so a key that moves the focus into it replaces the scroll the window would
  // otherwise make for that key.
  useWindowKeyDown(onKeyDownOutsideList);

  if (entries.length === 0) {
    const feed = collectionFeedOf(collection.route);
    return (
      <div className={styles.emptyState}>
        <OpensInNewTabDescriptionProvider>
          <p className={styles.emptyStateMessage}>
            There are no entries here yet. Check back soon
            {feed && (
              <>
                , or subscribe to the{" "}
                <ContentLink href={feed.path} className={styles.feedLink}>
                  Atom feed
                </ContentLink>{" "}
                in your feed reader
              </>
            )}
            .
          </p>
        </OpensInNewTabDescriptionProvider>
      </div>
    );
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
            entryIconUrl={collection.entryIconUrlOf(entry.slug)}
            href={collection.routeOf(entry.slug)}
            isOpen={entry.slug === openSlug}
            highlight={activationFlash.highlightOf(entry.slug)}
            categoryColumnLabels={categoryColumnLabels}
            dateFormat={dateFormat}
            itemProps={itemProps(index)}
            onOpen={() => openEntry(index)}
          />
        ))}
      </ul>
    </div>
  );
}
