import { useId } from "react";

import type { ComponentProps } from "react";

/**
 * An `<aside>` named by its `label` when it has one, rendered as a paragraph before its children.
 *
 * The label is a string because the fallback Markdown of a `Callout` or a `Rail` writes it from the
 * attribute's text.
 */
export function LabeledAside({
  label,
  labelClassName,
  children,
  ...props
}: ComponentProps<"aside"> & { label: string | undefined; labelClassName: string | undefined }) {
  const labelId = useId();

  return (
    <aside aria-labelledby={label !== undefined ? labelId : undefined} {...props}>
      {label !== undefined && (
        <p id={labelId} className={labelClassName}>
          {label}
        </p>
      )}
      {children}
    </aside>
  );
}
