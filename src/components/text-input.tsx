import { cx } from "#/lib/class-names";

import styles from "./text-input.module.css";

import type { ComponentProps } from "react";

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} type={props.type ?? "text"} className={cx(styles.field, className)} />;
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx(styles.field, styles.multiline, className)} />;
}
