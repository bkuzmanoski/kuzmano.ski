// Imports only types as a value imported from here would load the module this stands in for.
import type { WindowActions, WindowContent, WindowId, WindowRecord } from "#/lib/window-manager";

/** A `vi.mock` factory for `#/lib/window-manager`, so component suites stub one hook surface. */
export function windowManagerMock({
  actions = {},
  content = () => ({}),
  focusedWindow = () => null,
  notFoundRoute = () => null,
}: {
  actions?: Partial<WindowActions>;
  content?: () => WindowRecord<WindowContent>;
  focusedWindow?: () => WindowId | null;
  notFoundRoute?: () => string | null;
} = {}) {
  return {
    useWindowActions: () => actions,
    useWindowContent: content,
    useFocusedWindow: focusedWindow,
    useNotFoundRoute: notFoundRoute,
  };
}
