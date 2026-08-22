import { useId } from "react";

import { cx } from "#/lib/class-names";

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
  labelHidden = false,
  error,
  className,
  children,
}: {
  label: string;
  labelHidden?: boolean;
  error?: string;
  className?: string;
  children: (control: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className={cx(styles.composeField, className)}>
      <label className={labelHidden ? styles.hidden : styles.label} htmlFor={id}>
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? errorId : undefined })}
      <p className={styles.error} id={errorId}>
        {error}
      </p>
    </div>
  );
}
