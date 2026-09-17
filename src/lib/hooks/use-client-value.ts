import { useSyncExternalStore } from "react";

const noSubscribe = () => () => undefined;
const isClient = () => true;

/**
 * Returns a client-only value that remains stable for the current session.
 *
 * During server rendering and hydration, returns `serverValue`. After hydration, returns `read()`.
 * Ensure `read` returns the same value on every call.
 */
export function useClientValue<T>(serverValue: T, read: () => T): T {
  return useSyncExternalStore(noSubscribe, read, () => serverValue);
}

/** Whether hydration has finished. False for the server render and the hydration pass. */
export const useIsHydrated = () => useClientValue(false, isClient);
