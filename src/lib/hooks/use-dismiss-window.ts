import { createContext, use } from "react";

/**
 * The dismiss action for the window a subtree renders inside, provided by the
 * window layer. Null for views that are not rendered inside a window layer.
 */
export const DismissContext = createContext<(() => void) | null>(null);

function goHome() {
  location.href = "/";
}

/**
 * Dismisses the window the current subtree renders in, or navigates to the
 * home page if there is no window layer.
 */
export function useDismissWindow(): () => void {
  return use(DismissContext) ?? goHome;
}
