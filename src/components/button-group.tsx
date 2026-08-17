import clsx from "clsx";

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
    <div {...props} className={clsx(styles.buttonGroup, styles[alignment], className)}>
      {children}
    </div>
  );
}
