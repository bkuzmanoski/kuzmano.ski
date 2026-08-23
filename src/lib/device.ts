export const isMacOS = () => /Mac/i.test(navigator.userAgent);

/**
 * Whether the visitor has no pointer that can hover, so every press is a tap and text
 * entry brings up a software keyboard. Read where it is needed rather than held: a
 * device can gain or lose a pointer between one press and the next.
 */
export const isTouchOnly = () => (window as Partial<Window>).matchMedia?.("(any-hover: none)").matches ?? false;
