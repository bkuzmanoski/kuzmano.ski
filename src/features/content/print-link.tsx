import { usePressSound } from "#/lib/audio/use-press-sound.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";

import styles from "./print-link.module.css";

import type { ReactNode } from "react";

export function PrintLink({ children }: { children: ReactNode }) {
  const pressSoundHandlers = usePressSound({ defersTouchPressSound: true });
  return (
    <button
      type="button"
      className={styles.printLink}
      data-feed-omit
      {...mergeHandlers(pressSoundHandlers, { onClick: () => print() })}
    >
      {children}
    </button>
  );
}
