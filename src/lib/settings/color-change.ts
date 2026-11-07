import { createEmitter } from "../emitter.ts";
import { DARK_COLOR_SCHEME_QUERY, mediaQueryListFor } from "../media-query.ts";

const colorChangeEmitter = createEmitter();

export const notifyColorChange = () => colorChangeEmitter.emit();

/**
 * Calls `onChange` whenever the colors the document is shown in may have changed. Returns a function that stops
 * listening.
 */
export function subscribeToColorChange(onChange: () => void): () => void {
  const systemColorSchemeQuery = mediaQueryListFor(DARK_COLOR_SCHEME_QUERY);
  const unsubscribeFromNotifications = colorChangeEmitter.subscribe(onChange);

  systemColorSchemeQuery?.addEventListener("change", onChange);

  return () => {
    systemColorSchemeQuery?.removeEventListener("change", onChange);
    unsubscribeFromNotifications();
  };
}
