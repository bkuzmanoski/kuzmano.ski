import { useSyncExternalStore } from "react";

import { getHasBooted, serverHasBooted, subscribeToHasBooted } from "../boot";

export function useHasBooted(): boolean {
  return useSyncExternalStore(subscribeToHasBooted, getHasBooted, serverHasBooted);
}
