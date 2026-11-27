import { useSyncExternalStore } from "react";

import { mediaQueryListFor } from "../media-query.ts";

let reducedMotionQuery: MediaQueryList | null | undefined;

function getQuery() {
  reducedMotionQuery ??= mediaQueryListFor("(prefers-reduced-motion: reduce)");
  return reducedMotionQuery;
}

const subscribeToPrefersReducedMotion = (onChange: () => void): (() => void) => {
  const query = getQuery();

  query?.addEventListener("change", onChange);

  return () => query?.removeEventListener("change", onChange);
};

const serverPrefersReducedMotion = () => false;

/** Whether the user has asked for reduced motion, for reading outside a render. */
export function getPrefersReducedMotion(): boolean {
  return getQuery()?.matches ?? false;
}

/** Whether the user has asked for reduced motion, re-rendering if they change it. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeToPrefersReducedMotion, getPrefersReducedMotion, serverPrefersReducedMotion);
}
