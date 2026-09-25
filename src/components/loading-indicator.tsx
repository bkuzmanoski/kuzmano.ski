import LoadingIndicatorGraphic from "#/assets/images/loading-indicator.svg?react";
import { cx } from "#/lib/class-names.ts";

import styles from "./loading-indicator.module.css";

export function LoadingIndicator({
  label = "Loading",
  layout = "inline",
  className,
}: {
  label?: string;
  layout?: "inline" | "fill";
  className?: string;
}) {
  return (
    <span
      role={layout === "fill" ? "status" : "img"}
      className={cx(styles.loadingIndicator, styles[layout], className)}
      aria-label={label}
      data-loading-indicator="" // Marks the indicator for `/build/prerender/verify.ts`, which fails the build if a page is prerendered while a Suspense boundary is still pending.
    >
      <LoadingIndicatorGraphic />
    </span>
  );
}
