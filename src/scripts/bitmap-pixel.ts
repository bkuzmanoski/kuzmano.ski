import { bitmapPixelSizePxAt, subscribeToDevicePixelRatioChange } from "#/lib/bitmap-pixel.ts";

// Runs in the document head before first paint (prior to hydration) so that bitmap pixels land on whole device pixels
// from the first paint (see `--layout-bitmap-pixel` in `/src/styles.css`).

const setBitmapPixel = () =>
  document.documentElement.style.setProperty("--layout-bitmap-pixel", `${bitmapPixelSizePxAt(devicePixelRatio)}px`);

setBitmapPixel();
subscribeToDevicePixelRatioChange(setBitmapPixel);
