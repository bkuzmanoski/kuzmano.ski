export const isMacOS = () => /Mac/i.test(navigator.userAgent);

/**
 * Whether the visitor has no pointer that can hover, so every press is a tap and text entry brings up
 * a software keyboard. Read where it is needed rather than held: a device can gain or lose a pointer
 * between one press and the next.
 */
export const isTouchOnly = () => (window as Partial<Window>).matchMedia?.("(any-hover: none)").matches ?? false;

/** Calls `onChange` whenever the device pixel ratio changes. Returns a function that stops listening. */
export function subscribeToDevicePixelRatioChange(onChange: () => void): () => void {
  const resolutionQueryFor = (ratio: number) => matchMedia(`(resolution: ${ratio}dppx)`);

  let resolutionQuery = resolutionQueryFor(devicePixelRatio);

  const onResolutionChange = () => {
    resolutionQuery.removeEventListener("change", onResolutionChange);
    resolutionQuery = resolutionQueryFor(devicePixelRatio);
    resolutionQuery.addEventListener("change", onResolutionChange);
    onChange();
  };

  resolutionQuery.addEventListener("change", onResolutionChange);

  return () => resolutionQuery.removeEventListener("change", onResolutionChange);
}
