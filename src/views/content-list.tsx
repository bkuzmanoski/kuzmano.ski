import clsx from "clsx";

import FolderSmallIcon from "#/assets/images/folder-small.svg?react";
import type { Collection } from "#/content";
import { playClick } from "#/lib/audio/ui";
import { formatDate } from "#/lib/date";
import { useWindowActions, useWindowOrder } from "#/lib/window-manager";

import styles from "./content-list.module.css";

const DATE_FORMAT = new Intl.DateTimeFormat("en-AU", { year: "numeric", month: "short", day: "numeric" });

export function ContentList({ collection, basePath }: { collection: Collection; basePath: string }) {
  const openPaths = useWindowOrder();
  const { open } = useWindowActions();

  const entries = collection.list();

  return (
    <div className={styles.list}>
      <div className={styles.header}>
        <span className={styles.cellTitle}>
          <span className={styles.title}>Post</span>
        </span>
        <span className={styles.cellCategory}>Category</span>
        <span className={styles.cellDate}>Date</span>
      </div>

      {entries.map((entry) => {
        const href = `${basePath}/${entry.slug}`;
        const isOpen = openPaths.includes(href);

        return (
          <a
            key={entry.slug}
            aria-label={entry.title}
            className={clsx(styles.row, isOpen && styles.open)}
            href={href}
            onClick={(event) => event.preventDefault()}
            onDoubleClick={(event) => {
              event.preventDefault();
              open(href);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                playClick();
                open(href);
              }
            }}
            onPointerDown={(event) => {
              playClick();
              event.currentTarget.focus();
            }}
          >
            <span className={styles.cellTitle}>
              <span className={styles.icon} aria-hidden>
                <FolderSmallIcon />
              </span>
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
