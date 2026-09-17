import { isMacOS } from "../device.ts";

import { useClientValue } from "./use-client-value.ts";

/** Whether the visitor is on macOS. */
export function useIsMacOS(): boolean {
  return useClientValue(true, isMacOS); // Note: Assume macOS for this audience.
}
