export const cssPixelsPerDitherDot = (devicePixelRatio: number): number =>
  Math.max(1, Math.round(devicePixelRatio)) / devicePixelRatio; // 1px rounded to a whole number of device pixels, and at least one.
