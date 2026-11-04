import { isApplePlatform } from "../device.ts";

import { useClientValue } from "./use-client-value.ts";

/** Whether the device runs macOS, iOS, or iPadOS, once hydration has finished. */
export function useIsApplePlatform(): boolean {
  return useClientValue(true, isApplePlatform); // Default to Apple during server rendering because most visitors use Apple devices.
}
