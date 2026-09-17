import { useSyncExternalStore } from "react";

import { noSubscribe } from "../emitter.ts";

const canShare = () => typeof navigator.share === "function";
const serverCanShare = () => false;

export function useCanShare(): boolean {
  return useSyncExternalStore(noSubscribe, canShare, serverCanShare);
}
