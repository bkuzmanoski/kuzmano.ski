import { useSyncExternalStore } from "react";

let reducedMotionQuery: MediaQueryList | null | undefined;

function getQuery() {
  reducedMotionQuery ??= (window as Partial<Window>).matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
  return reducedMotionQuery;
}

const subscribe = (onChange: () => void) => {
  const query = getQuery();

  query?.addEventListener("change", onChange);

  return () => query?.removeEventListener("change", onChange);
};

const serverPrefersReducedMotion = () => false;

/** Whether the visitor has asked for reduced motion, for reading outside a render. */
export function getPrefersReducedMotion(): boolean {
  return getQuery()?.matches ?? false;
}

/** Whether the visitor has asked for reduced motion, re-rendering if they change it. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getPrefersReducedMotion, serverPrefersReducedMotion);
}
