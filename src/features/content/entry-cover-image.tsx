import DocumentDesktopIcon from "#/assets/images/desktop-icon-document.svg?react";
import { cx } from "#/lib/class-names.ts";
import { useEntryCoverImage } from "#/lib/content/entry-cover-images.ts";
import type { EntryKey } from "#/lib/content/entry-file.ts";

import styles from "./entry-cover-image.module.css";

export function EntryCoverImage({ entryKey, className }: { entryKey: EntryKey; className?: string }) {
  const coverImage = useEntryCoverImage(entryKey);

  if (!coverImage) {
    return (
      <span className={cx(styles.coverImage, className)}>
        <DocumentDesktopIcon className={styles.documentDesktopIcon} />
      </span>
    );
  }

  const { thumbnail } = coverImage;

  return (
    <span className={cx(styles.coverImage, className)}>
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
