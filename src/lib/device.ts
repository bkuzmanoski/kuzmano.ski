import { mediaQueryListFor } from "./media-query.ts";

/** Whether the device runs macOS, iOS, or iPadOS. */
export const isApplePlatform = () => /Mac/i.test(navigator.userAgent); // The user agent of iOS includes "like Mac OS X".

/** Whether the device runs iOS or iPadOS. */
export const isIOS = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1); // iPadOS reports the user agent of a Mac by default, so a touch screen tells it apart from one.

/**
 * Whether no available pointer can hover. Evaluate this when needed because connected input devices may change between
 * interactions.
 */
export const isTouchOnly = () => mediaQueryListFor("(any-hover: none)")?.matches ?? false;
