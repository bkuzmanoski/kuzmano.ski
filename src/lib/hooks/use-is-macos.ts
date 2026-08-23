import { useSyncExternalStore } from "react";

import { isMacOS } from "../device";
import { noSubscribe } from "../emitter";

const serverIsMacOS = () => true; // Note: Assume macOS for this audience.

/**
 * Whether the visitor is on macOS.
 *
 * The platform cannot change under a session, so nothing subscribes; the
 * store exists to keep the server render and hydration agreeing on macOS.
 */
export function useIsMacOS(): boolean {
  return useSyncExternalStore(noSubscribe, isMacOS, serverIsMacOS);
}
