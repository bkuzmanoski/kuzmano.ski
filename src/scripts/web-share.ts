// Runs in the document head before first paint (prior to hydration) so a share control is laid out
// from the first paint in a browser that supports the Web Share API.

if (typeof navigator.share === "function") {
  document.documentElement.setAttribute("data-web-share", "");
}
