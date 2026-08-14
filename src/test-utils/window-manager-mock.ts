import type { WindowActions, WindowContent, WindowId, WindowRecord } from "#/lib/window-manager";

/* Imports only types as a value imported from here would load the module this stands in for. */

/** A `vi.mock` factory for `#/lib/window-manager`, so component suites stub one hook surface. */
export function windowManagerMock({
  actions = {},
  content = () => ({}),
  focusedWindow = () => null,
}: {
  actions?: Partial<WindowActions>;
  content?: () => WindowRecord<WindowContent>;
  focusedWindow?: () => WindowId | null;
} = {}) {
  return {
    useWindowActions: () => actions,
    useWindowContent: content,
    useFocusedWindow: focusedWindow,
  };
}
