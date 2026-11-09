import { cx } from "#/lib/class-names.ts";

import styles from "./content-body.module.css";
import { LabeledAside } from "./labeled-aside.tsx";

import type { ComponentProps } from "react";

/**
 * An authored rail aside, named by its `label` when it has one. The layout places it in the rail beside the element
 * before it, and in the text column where the content pane is too narrow for a rail. The build groups each run of rail
 * asides and names the element before the run as the anchor that the layout places the group beside (see
 * `/build/content/markup/rail-asides.ts`). Its styles are in `content-body.module.css` because the layout places and
 * spaces the aside against the entry's other rail items.
 */
export function Aside({ label, className, ...props }: ComponentProps<"aside"> & { label?: string }) {
  return (
    <LabeledAside
      label={label}
      labelClassName={styles.railLabel}
      className={cx(styles.railAside, className)}
      {...props}
    />
  );
}
