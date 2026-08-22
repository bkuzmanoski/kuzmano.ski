const ARROW_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const;

export type ArrowKey = (typeof ARROW_KEYS)[number];

export const isArrowKey = (key: string): key is ArrowKey => ARROW_KEYS.includes(key as ArrowKey);

/** The keys that activate the control holding the focus. */
export const isActivationKey = (key: string) => key === "Enter" || key === " ";

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (EDITABLE_TAGS.has(target.tagName) || target.isContentEditable);
}
