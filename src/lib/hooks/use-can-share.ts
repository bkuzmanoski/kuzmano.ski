import { useClientValue } from "./use-client-value.ts";

const canShare = () => typeof navigator.share === "function";

export function useCanShare(): boolean {
  return useClientValue(false, canShare);
}
