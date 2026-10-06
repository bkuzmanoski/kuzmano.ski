// Runs in the document head before first paint (prior to hydration) so the dither patterns are rendered at a whole
// number of device pixels from the first paint (see `dither-fill` in `/src/mixins.css`). The value is updated
// whenever the device pixel ratio changes.

function setDevicePixelRatio() {
  const ratio = window.devicePixelRatio;

  document.documentElement.style.setProperty("--device-pixel-ratio", String(ratio));
  matchMedia(`(resolution: ${ratio}dppx)`).addEventListener("change", setDevicePixelRatio, { once: true });
}

setDevicePixelRatio();
