import { FOCUSED_WINDOW_CONTENT_ID } from "#/components/window";
import { isBrowserHandledClick } from "#/lib/link";
import { useFocusedWindow } from "#/lib/window-manager";

import styles from "./skip-link.module.css";

export function SkipLink() {
  const focusedWindow = useFocusedWindow();

  if (focusedWindow === null) {
    return null;
  }

  return (
    <a
      className={styles.skipLink}
      href={`#${FOCUSED_WINDOW_CONTENT_ID}`}
      onClick={(event) => {
        if (isBrowserHandledClick(event)) {
          return;
        }

        const target = document.getElementById(FOCUSED_WINDOW_CONTENT_ID);

        if (target) {
          event.preventDefault();
          target.focus();
        }
      }}
    >
      Jump to content
    </a>
  );
}
