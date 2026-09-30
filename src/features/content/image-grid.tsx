import styles from "./image-grid.module.css";

import type { CSSProperties, ReactNode } from "react";

export function ImageGrid({
  caption,
  style,
  children,
}: {
  caption?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <figure style={style} data-image-grid>
      <div className={styles.images} data-content-default-styles="off">
        {children}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
