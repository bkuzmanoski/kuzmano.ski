import { cx } from "#/lib/class-names.ts";

import styles from "./callout.module.css";
import { LabeledAside } from "./labeled-aside.tsx";

import type { CalloutVariant } from "./callout-variants.ts";
import type { ComponentProps } from "react";

const CALLOUT_VARIANT_CLASS_NAMES: Record<CalloutVariant, string | undefined> = {
  note: undefined,
  warning: styles.calloutWarning,
};

export function Callout({
  label,
  variant = "note",
  className,
  ...props
}: ComponentProps<"aside"> & { label?: string; variant?: CalloutVariant }) {
  return (
    <LabeledAside
      label={label}
      labelClassName={styles.calloutLabel}
      className={cx(styles.callout, CALLOUT_VARIANT_CLASS_NAMES[variant], className)}
      data-callout
      data-content-panel
      {...props}
    />
  );
}
