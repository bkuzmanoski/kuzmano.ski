import WatchIcon from "#/assets/images/spinner.svg?react";
import { cx } from "#/lib/class-names";

import styles from "./spinner.module.css";

/**
 * A loading indicator.
 *
 * `inline` renders at its natural size and is announced as an image when reached.
 * `fill` centres itself in its container and uses a live region for content that
 * arrives after the surrounding page.
 *
 * `label` describes the work being waited for rather than the indicator itself.
 *
 * `data-loading-indicator` marks the indicator for `build/prerender.ts`, which fails
 * the build if a page is prerendered while a Suspense boundary is still pending.
 */
export function Spinner({
  variant = "inline",
  label = "Loading",
  className,
}: {
  variant?: "inline" | "fill";
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cx(styles.spinner, styles[variant], className)}
      data-loading-indicator=""
      role={variant === "fill" ? "status" : "img"}
      aria-label={label}
    >
      <WatchIcon aria-hidden />
    </span>
  );
}
