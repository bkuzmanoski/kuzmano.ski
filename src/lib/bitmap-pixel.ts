// Has no imports because pre-hydration scripts bundle this module (see `/build/inline-scripts.ts`).

/** Returns the CSS-pixel size of one bitmap pixel at `devicePixelRatio`, rounded to at least one whole device pixel. */
export const bitmapPixelSizePxAt = (devicePixelRatio: number): number =>
  Math.max(1, Math.round(devicePixelRatio)) / devicePixelRatio;

/** Calls `onChange` whenever the device pixel ratio changes. Returns a function that stops listening. */
export function subscribeToDevicePixelRatioChange(onChange: () => void): () => void {
  const resolutionQueryFor = (ratio: number) => matchMedia(`(resolution: ${ratio}dppx)`);

  let resolutionQuery = resolutionQueryFor(devicePixelRatio);

  const onResolutionChange = () => {
    resolutionQuery.removeEventListener("change", onResolutionChange);
    resolutionQuery = resolutionQueryFor(devicePixelRatio); // A query for the resolution stops matching at the first change, so replace it with a query for the new resolution.
    resolutionQuery.addEventListener("change", onResolutionChange);
    onChange();
  };

  resolutionQuery.addEventListener("change", onResolutionChange);

  return () => resolutionQuery.removeEventListener("change", onResolutionChange);
}
