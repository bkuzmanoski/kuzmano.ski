import { playClickSound } from "#/lib/audio/sounds.ts";

import styles from "./print-link.module.css";

import type { ReactNode } from "react";

export function PrintLink({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className={styles.printLink}
      data-feed-omit
      onClick={() => {
        playClickSound();
        print();
      }}
    >
      {children}
    </button>
  );
}
