import { cx } from "#/lib/class-names";
import type { FieldBinding } from "#/lib/forms/use-field";

import styles from "./compose-field.module.css";

import type { ReactNode } from "react";

export function ComposeValue({
  label,
  actions,
  children,
}: {
  label: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.composeField}>
      <span className={styles.label}>{label}</span>
      <p className={styles.value}>{children}</p>
      {actions}
    </div>
  );
}

export function ComposeField({
  label,
  field,
  labelHidden = false,
  className,
  children,
}: {
  label: string;
  field: FieldBinding;
  labelHidden?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx(styles.composeField, className)}>
      <label className={labelHidden ? styles.hidden : styles.label} htmlFor={field.control.id}>
        {label}
      </label>
      {children}
      <p className={styles.error} id={field.errorId}>
        {field.error}
      </p>
    </div>
  );
}
