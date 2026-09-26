/**
 * Valid `data-content-span` values for selecting an element's content-grid columns. Elements without this attribute
 * span `text`. The build uses this list to validate MDX attributes (see `/build/content/markup/content-spans.ts`).
 */
export const CONTENT_SPANS = ["text", "rail", "wide", "pane"] as const;
