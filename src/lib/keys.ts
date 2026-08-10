const ARROW_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const;

export type ArrowKey = (typeof ARROW_KEYS)[number];

export const isArrowKey = (key: string): key is ArrowKey => ARROW_KEYS.includes(key as ArrowKey);

/** The keys that activate the control holding the focus. */
export const isActivationKey = (key: string) => key === "Enter" || key === " ";
