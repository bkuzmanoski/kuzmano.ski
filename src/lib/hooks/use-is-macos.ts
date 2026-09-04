import { useSyncExternalStore } from "react";

import { isMacOS } from "../device.ts";
import { noSubscribe } from "../emitter.ts";

const serverIsMacOS = () => true; // Note: Assume macOS for this audience.

/**
 * Whether the visitor is on macOS.
 *
 * The platform cannot change during a session, so `noSubscribe` never registers a
 * listener; the store exists to keep the server render and hydration agreeing on macOS.
 */
export function useIsMacOS(): boolean {
  return useSyncExternalStore(noSubscribe, isMacOS, serverIsMacOS);
}
