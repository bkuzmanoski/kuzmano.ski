// Imports only types from `#/lib/window-manager/context.ts` because the `vi.mock` factories for that
// module import this one (a value import from it hangs the suite).
import type { WindowActions } from "#/lib/window-manager/context.ts";
import type { WindowContent, WindowId, WindowRecord } from "#/lib/window-manager/window.ts";

/** A `vi.mock` factory for `#/lib/window-manager/context`, so component suites stub one hook surface. */
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
