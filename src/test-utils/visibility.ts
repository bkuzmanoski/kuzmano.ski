import { vi } from "vitest";

/**
 * Mocks document visibility starting at `initialState`. Returns a function that updates the state and dispatches a
 * `visibilitychange` event on `document`, simulating a browser tab switch.
 */
export function stubVisibilityState(initialState: DocumentVisibilityState = "visible") {
  let visibilityState = initialState;

  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibilityState);
  vi.spyOn(document, "hidden", "get").mockImplementation(() => visibilityState === "hidden");

  return (nextState: DocumentVisibilityState) => {
    visibilityState = nextState;
    document.dispatchEvent(new Event("visibilitychange"));
  };
}
