import type { WindowActions, WindowId } from "#/lib/window-manager";

/* Imports only types, so a `vi.mock` factory for `#/lib/window-manager` can load
 * it without importing anything that circles back into the mocked module. */

/** A `vi.mock` factory for `#/lib/window-manager`, so component suites stub one hook surface. */
export function windowManagerMock({
  actions = {},
  focusedWindow = () => null,
}: {
  actions?: Partial<WindowActions>;
  focusedWindow?: () => WindowId | null;
} = {}) {
  return {
    useWindowActions: () => actions,
    useFocusedWindow: focusedWindow,
  };
}
