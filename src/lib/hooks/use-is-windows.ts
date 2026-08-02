import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};
const readIsWindows = () => /Win/i.test(navigator.userAgent);
const serverIsWindows = () => false;

/**
 * Whether the visitor is on Windows, for labelling the modifier a shortcut is
 * bound to. The platform cannot change under a session, so nothing subscribes;
 * the store exists to keep the server render and hydration agreeing on macOS.
 */
export function useIsWindows(): boolean {
  return useSyncExternalStore(noSubscribe, readIsWindows, serverIsWindows);
}
