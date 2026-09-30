import { cx } from "#/lib/class-names.ts";

import styles from "./content-body.module.css";

import type { ComponentProps } from "react";

export function Footnote({
  number,
  className,
  children,
  ...props
}: Omit<ComponentProps<"aside">, "role"> & { id: string; number: string }) {
  return (
    <aside
      role="doc-footnote"
      tabIndex={-1}
      aria-label={`Footnote ${number}`}
      className={cx(styles.railAside, className)}
      data-footnote
      {...props}
    >
      <p className={styles.railLabel} aria-hidden="true" data-feed-omit>
        {number}
      </p>
      {children}
    </aside>
  );
}
