import { preload } from "react-dom";

/**
 * Preloads a WOFF2 font during render. On the server, React adds the preload to the document head.
 * In the browser, it avoids adding a duplicate preload.
 *
 * Unlike a rendered `<link>` tag, this preload is not tied to the component tree, so StrictMode
 * remounts in development do not remove and reinsert it, which can trigger an unnecessary refetch.
 */
export const preloadFont = (href: string) =>
  preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
