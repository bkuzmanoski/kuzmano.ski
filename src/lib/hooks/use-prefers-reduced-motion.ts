import { useSyncExternalStore } from "react";

let query: MediaQueryList | null | undefined;

function getQuery() {
  query ??= (window as Partial<Window>).matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
  return query;
}

const subscribe = (onChange: () => void) => {
  const media = getQuery();

  media?.addEventListener("change", onChange);

  return () => media?.removeEventListener("change", onChange);
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
