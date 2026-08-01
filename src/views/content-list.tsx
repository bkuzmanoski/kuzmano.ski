import clsx from "clsx";
import { useState } from "react";

import FolderSmallIcon from "#/assets/images/folder-small.svg?react";
import type { Collection } from "#/content";
import { formatDate } from "#/lib/date";
import { playClick } from "#/lib/sound";
import { useWindowActions, useWindowOrder } from "#/lib/window-manager";

import styles from "./content-list.module.css";

const DATE_FORMAT = new Intl.DateTimeFormat("en-AU", { year: "numeric", month: "short", day: "numeric" });

export function ContentList({ collection, basePath }: { collection: Collection; basePath: string }) {
  const entries = collection.list();
  const openPaths = useWindowOrder();
  const { open } = useWindowActions();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className={styles.list}>
      <div className={styles.header}>
        <span className={clsx(styles.cellEntry, styles.header)}>Post</span>
        <span className={clsx(styles.cellCategory, styles.header)}>Category</span>
        <span className={clsx(styles.cellDate, styles.header)}>Date</span>
      </div>

      {entries.map((entry) => {
        const href = `${basePath}/${entry.slug}`;
        const isOpen = openPaths.includes(href);
        const isSelected = selected === entry.slug;

        return (
          <a
            key={entry.slug}
            aria-label={entry.title}
            className={clsx(styles.row, isSelected && styles.selected, isOpen && styles.open)}
            href={href}
            onClick={(event) => {
              event.preventDefault();
              setSelected(entry.slug);
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              open(href);
            }}
            onFocus={() => setSelected(entry.slug)}
            onPointerDown={playClick}
          >
            <span className={styles.cellEntry}>
              <FolderSmallIcon className={styles.icon} />
              <span className={styles.title}>{entry.title}</span>
            </span>
            <span className={styles.cellCategory}>{entry.category ?? ""}</span>
            <span className={styles.cellDate}>{formatDate(entry.date, DATE_FORMAT)}</span>
          </a>
        );
      })}
    </div>
  );
}
