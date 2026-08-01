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
        <span className={styles.headerPost}>Post</span>
        <span>Category</span>
        <span>Date</span>
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
            <span className={styles.cellPost}>
              <FolderSmallIcon className={styles.icon} />
              <span className={styles.title}>{entry.title}</span>
            </span>
            <span className={styles.cellMetadata}>{entry.category ?? ""}</span>
            <span className={styles.cellMetadata}>{formatDate(entry.date, DATE_FORMAT)}</span>
          </a>
        );
      })}
    </div>
  );
}
