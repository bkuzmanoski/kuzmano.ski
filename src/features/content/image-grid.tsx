import styles from "./image-grid.module.css";

import type { ReactNode } from "react";

export function ImageGrid({ caption, children }: { caption?: string; children: ReactNode }) {
  return (
    <figure data-image-grid>
      <div className={styles.images} data-content-default-styles="off">
        {children}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
