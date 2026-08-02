import { useSyncExternalStore } from "react";

import { getIsBootSequenceComplete, serverIsBootSequenceComplete, subscribeToIsBootSequenceComplete } from "../boot";

export function useIsBootSequenceComplete(): boolean {
  return useSyncExternalStore(
    subscribeToIsBootSequenceComplete,
    getIsBootSequenceComplete,
    serverIsBootSequenceComplete,
  );
}
