import { cx } from "#/lib/class-names";

import styles from "./text-input.module.css";

import type { ComponentProps, ReactNode } from "react";

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} type={props.type ?? "text"} className={cx(styles.control, className)} />;
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx(styles.control, styles.multiline, className)} />;
}

export function TextInputFrame({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cx(styles.frame, className)}>{children}</span>;
}
