import SpinnerIcon from "#/assets/images/spinner.svg?react";
import { cx } from "#/lib/class-names";

import styles from "./spinner.module.css";

/**
 * A loading indicator.
 *
 * `label` describes the work being waited for rather than the indicator itself.
 *
 * The `inline` layout is announced as an image when reached. The `fill` layout centres
 * itself in its container and uses a live region for content that arrives after the
 * surrounding page.
 *
 * `data-loading-indicator` marks the indicator for `build/prerender.ts`, which fails
 * the build if a page is prerendered while a Suspense boundary is still pending.
 */
export function Spinner({
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
      className={cx(styles.spinner, styles[layout], className)}
      data-loading-indicator=""
      role={layout === "fill" ? "status" : "img"}
      aria-label={label}
    >
      <SpinnerIcon aria-hidden />
    </span>
  );
}
