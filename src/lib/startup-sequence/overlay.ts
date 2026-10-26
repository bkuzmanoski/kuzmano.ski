// This module has no imports, so the pre-hydration startup sequence script can use it (see `/build/inline-scripts.ts`).

/** Set on `<html>` to hide the server-rendered desktop until the startup sequence has loaded. */
export const STARTUP_SEQUENCE_OVERLAY_ATTRIBUTE = "data-startup-sequence-overlay";

/**
 * Matches the `theme-color` pair for the startup screen's backdrop, which `/src/app/root-document.tsx`
 * renders ahead of the desktop's until the startup sequence has run.
 */
export const STARTUP_SEQUENCE_THEME_COLOR_SELECTOR = "meta[data-startup-sequence-theme-color]";

export const setStartupSequenceOverlay = () =>
  document.documentElement.setAttribute(STARTUP_SEQUENCE_OVERLAY_ATTRIBUTE, "");
export const clearStartupSequenceOverlay = () =>
  document.documentElement.removeAttribute(STARTUP_SEQUENCE_OVERLAY_ATTRIBUTE);
export const clearStartupSequenceThemeColor = () =>
  document.querySelectorAll(STARTUP_SEQUENCE_THEME_COLOR_SELECTOR).forEach((meta) => meta.remove());
