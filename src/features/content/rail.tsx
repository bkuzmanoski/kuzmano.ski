import { cx } from "#/lib/class-names.ts";

import styles from "./content-body.module.css";
import { LabeledAside } from "./labeled-aside.tsx";

import type { ComponentProps } from "react";

/**
 * An aside in the rail beside the text column, named by its `label` when it has one.
 *
 * Its styles are in `content-body.module.css` rather than a stylesheet of its own, because the
 * spacing of the entry's grid depends on the anchor.
 */
export function Rail({ label, className, ...props }: ComponentProps<"aside"> & { label?: string }) {
  return (
    // The aside is positioned out of flow in the rail, so a zero-height element marks its place in the flow.
    <div className={styles.railAnchor}>
      <LabeledAside label={label} labelClassName={styles.railLabel} className={cx(styles.rail, className)} {...props} />
    </div>
  );
}
