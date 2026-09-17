import { useEffect, useEffectEvent } from "react";

import { isEditableTarget } from "../keys.ts";

/**
 * A global keyboard shortcut. Modifier is Option/Alt. `code` is the
 * physical key from KeyboardEvent.code. `key` is not used because
 * Option changes the character that `key` reports on macOS.
 */
export interface KeyboardShortcut {
  code: string;
  run: () => void;
  enabled?: boolean;
  invokesWhileEditing?: boolean;
}

export function useGlobalShortcuts(shortcuts: Array<KeyboardShortcut>) {
  const runMatch = useEffectEvent((event: KeyboardEvent) => {
    const isEditing = isEditableTarget(event.target);
    const matchedShortcut = shortcuts.find(
      (shortcut) =>
        shortcut.code === event.code &&
        shortcut.enabled !== false &&
        (!isEditing || shortcut.invokesWhileEditing === true),
    );

    if (matchedShortcut) {
      event.preventDefault();
      matchedShortcut.run();
    }
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.altKey || event.metaKey || event.ctrlKey) {
        return;
      }

      runMatch(event);
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
