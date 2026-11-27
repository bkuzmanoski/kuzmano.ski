// Has no imports because `/vite.config.ts` loads this module through `/build`.

/** Fallback prefix replacing a waitlist in feeds and Markdown, followed by the entry's URL (or a link to it). */
export const FALLBACK_TEXT_BEFORE_URL = "Join the waitlist at ";

export const fallbackText = (url: string) => `${FALLBACK_TEXT_BEFORE_URL}${url}`;
