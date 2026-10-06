import { cx } from "#/lib/class-names.ts";
import { useCaretScrollPadding } from "#/lib/hooks/use-caret-scroll-padding.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";

import styles from "./text-input.module.css";

import type { ComponentProps, ReactNode } from "react";

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} type={props.type ?? "text"} className={cx(styles.control, className)} />;
}

export function TextArea({ className, onInput, onKeyDown, onScroll, ...props }: ComponentProps<"textarea">) {
  const caretScrollPadding = useCaretScrollPadding<HTMLTextAreaElement>();

  return (
    <textarea
      className={cx(styles.control, styles.multiline, className)}
      {...props}
      {...mergeHandlers(caretScrollPadding, { onInput, onKeyDown, onScroll })}
    />
  );
}

export function TextInputFrame({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cx(styles.frame, className)}>{children}</span>;
}
