import { cx } from "#/lib/class-names.ts";

import styles from "./content-body.module.css";
import { LabeledAside } from "./labeled-aside.tsx";

import type { ComponentProps } from "react";

/**
 * An aside in the rail beside the element before it, named by its `label` when it has one. The build
 * groups each run of rail asides and names the element before the run as the anchor the group is placed
 * beside (see `/build/content/markup/rail-asides.ts`). Its styles are in `content-body.module.css`
 * because the aside is placed and spaced against the entry's other rail items.
 */
export function Rail({ label, className, ...props }: ComponentProps<"aside"> & { label?: string }) {
  return (
    <LabeledAside
      label={label}
      labelClassName={styles.railLabel}
      className={cx(styles.railAside, className)}
      {...props}
    />
  );
}
