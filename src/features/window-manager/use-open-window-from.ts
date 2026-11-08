import { useWindowActions } from "#/lib/window-manager/context.ts";
import { useZoomRect } from "#/lib/window-manager/use-zoom-rect.ts";
import { resolveWindow } from "#/site/windows.ts";

/** Returns `openWindowFrom`, which opens the window for `route` and animates it from `element` using `useZoomRect`. */
export function useOpenWindowFrom() {
  const { open } = useWindowActions();
  const zoomFrom = useZoomRect();

  return function openWindowFrom(route: string, element: Element | null | undefined) {
    const windowId = resolveWindow(route)?.id;

    if (element && windowId) {
      zoomFrom(element, windowId);
    }

    open(route);
  };
}
