import { useSyncExternalStore } from "react";

import {
  getIsBootSequenceComplete,
  serverIsBootSequenceComplete,
  subscribeToIsBootSequenceComplete,
} from "./lifecycle";

export function useIsBootSequenceComplete(): boolean {
  return useSyncExternalStore(
    subscribeToIsBootSequenceComplete,
    getIsBootSequenceComplete,
    serverIsBootSequenceComplete,
  );
}
