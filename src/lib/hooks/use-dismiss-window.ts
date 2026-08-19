import { createContext, use } from "react";

/** The dismiss action for the window a subtree renders in, provided by the window layer if present. */
export const DismissContext = createContext<(() => void) | null>(null);

/** Dismisses the window the current subtree renders in, or null if there is no window layer. */
export function useDismissWindow(): (() => void) | null {
  return use(DismissContext);
}
