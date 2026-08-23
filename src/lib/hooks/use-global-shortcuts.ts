import { useEffect, useEffectEvent } from "react";

import { isEditableTarget } from "../keys";

/**
 * A global keyboard shortcut. Modifier is Option/Alt. `code` is the
 * physical key from KeyboardEvent.code. `key` is not used because
 * Option changes the character that `key` reports on macOS.
 */
export interface KeyboardShortcut {
  code: string;
  run: () => void;
  enabled?: boolean;
  runsWhileEditing?: boolean;
}

export function useGlobalShortcuts(shortcuts: Array<KeyboardShortcut>) {
  const runMatch = useEffectEvent((event: KeyboardEvent) => {
    const isEditing = isEditableTarget(event.target);
    const match = shortcuts.find(
      (shortcut) =>
        shortcut.code === event.code &&
        shortcut.enabled !== false &&
        (!isEditing || shortcut.runsWhileEditing === true),
    );

    if (match) {
      event.preventDefault();
      match.run();
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
