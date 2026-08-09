import type { CSSProperties } from "react";

/** Inline styles that may also set custom properties. */
export type StyleWithVars = CSSProperties & Record<`--${string}`, string | number>;
