import { FOCUSED_WINDOW_CONTENT_ID } from "#/features/window-manager/window.tsx";
import { focusWithTabIndexUntilBlur } from "#/lib/focus.ts";
import { isBrowserHandledClick } from "#/lib/link.ts";
import { useFocusedWindow } from "#/lib/window-manager/context.ts";

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
          focusWithTabIndexUntilBlur(target); // The content has no name of its own, so it is focusable only from the skip link's activation.
        }
      }}
    >
      Jump to content
    </a>
  );
}
