import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * A global keyboard shortcut. Modifier is Option/Alt. `code` is the
 * hysical key from KeyboardEvent.code. `key` is not used because
 * Option changes the character that `key` reports on macOS.
 */
export interface KeyboardShortcut {
  code: string;
  run: () => void;
  enabled?: boolean;
}

export function useGlobalShortcuts(shortcuts: Array<KeyboardShortcut>) {
  const ref = useRef(shortcuts);

  useEffect(() => {
    ref.current = shortcuts;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.altKey || event.metaKey || event.ctrlKey) {
        return;
      }

      const match = ref.current.find((shortcut) => shortcut.code === event.code && shortcut.enabled !== false);

      if (match) {
        event.preventDefault();
        match.run();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

const noSubscribe = () => () => {};
const readIsWindows = () => /Win/i.test(navigator.userAgent);
const serverIsWindows = () => false;

export function useIsWindows(): boolean {
  return useSyncExternalStore(noSubscribe, readIsWindows, serverIsWindows);
}
