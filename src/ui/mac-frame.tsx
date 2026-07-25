import styles from "./mac-frame.module.css";

import type { ReactNode } from "react";

export function MacFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.case}>
      <div className={styles.screen}>{children}</div>
      <div className={styles.badge}>Macintosh</div>
    </div>
  );
}
