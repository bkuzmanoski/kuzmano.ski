import { cx } from "#/lib/class-names";

import styles from "./button-group.module.css";

import type { ComponentPropsWithoutRef } from "react";

export function ButtonGroup({
  alignment = "right",
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  alignment?: "left" | "center" | "right";
}) {
  return (
    <div {...props} className={cx(styles.buttonGroup, styles[alignment], className)}>
      {children}
    </div>
  );
}
