// Runs in the document head before first paint (prior to hydration) so that bitmap pixels land on whole device pixels
// from the first paint (see `--layout-bitmap-pixel` in `/src/styles.css`).

function setDevicePixelRatio() {
  const ratio = window.devicePixelRatio;

  document.documentElement.style.setProperty("--device-pixel-ratio", String(ratio));
  matchMedia(`(resolution: ${ratio}dppx)`).addEventListener("change", setDevicePixelRatio, { once: true });
}

setDevicePixelRatio();
