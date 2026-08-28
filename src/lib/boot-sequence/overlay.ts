// This module has no imports, so the pre-hydration overlay script can use it (see `/build/inline-script.ts`).

/**
 * Set on `<html>` to hide the server-rendered desktop until the boot sequence has
 * taken loaded. The stylesheet shows the cover while this attribute is set.
 */
export const BOOT_SEQUENCE_OVERLAY_ATTRIBUTE = "data-boot-sequence-overlay";

/**
 * Marks the `theme-color` pair matching the boot screen's backdrop, which
 * `root-document.tsx` renders ahead of the desktop's until the boot sequence has run.
 */
export const BOOT_SEQUENCE_THEME_COLOR_SELECTOR = "meta[data-boot-sequence-theme-color]";

export const setBootSequenceOverlay = () => document.documentElement.setAttribute(BOOT_SEQUENCE_OVERLAY_ATTRIBUTE, "");
export const clearBootSequenceOverlay = () => document.documentElement.removeAttribute(BOOT_SEQUENCE_OVERLAY_ATTRIBUTE);
export const clearBootSequenceThemeColor = () =>
  document.querySelectorAll(BOOT_SEQUENCE_THEME_COLOR_SELECTOR).forEach((meta) => meta.remove());
