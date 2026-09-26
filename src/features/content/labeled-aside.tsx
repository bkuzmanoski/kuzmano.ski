import { useId } from "react";

import type { ComponentProps } from "react";

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
