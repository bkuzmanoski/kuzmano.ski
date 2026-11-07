import { isEditableTarget } from "../keys.ts";

import { useEventListeners } from "./use-event-listeners.ts";

/**
 * A global keyboard shortcut. Modifier is Option/Alt. `code` is the physical key from KeyboardEvent.code. `key` is not
 * used because Option changes the character that `key` reports on macOS.
 */
export interface KeyboardShortcut {
  code: string;
  run: () => void;
  enabled?: boolean;
  invokesWhileEditing?: boolean;
}

export function useGlobalShortcuts(shortcuts: Array<KeyboardShortcut>) {
  useEventListeners("window", {
    keydown: (event) => {
      if (!event.altKey || event.metaKey || event.ctrlKey) {
        return;
      }

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
    },
  });
}
