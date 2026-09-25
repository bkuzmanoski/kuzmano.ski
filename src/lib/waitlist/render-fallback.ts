/**
 * The text that replaces a waitlist in a feed and in the Markdown representation. It ends with the
 * entry's URL, so the Markdown representation can write the URL as a link after the text before it.
 */
export const FALLBACK_TEXT_BEFORE_URL = "Join the waitlist at ";

export const fallbackText = (url: string) => `${FALLBACK_TEXT_BEFORE_URL}${url}`;
