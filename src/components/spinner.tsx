import WatchIcon from "#/assets/images/spinner.svg?react";
import { cx } from "#/lib/class-names";

import styles from "./spinner.module.css";

/**
 * A System 6-era watch, its minute hand ticking clockwise to mark time passing.
 *
 * The watch takes its color from `currentColor`; `--step-ms` sets how long each
 * position of the hand is held for. Caller can set each via `className`.
 */
export function Spinner({
  label = "Loading",
  size = "regular",
  className,
}: {
  label?: string;
  size?: "regular" | "small";
  className?: string;
}) {
  return (
    <WatchIcon
      className={cx(styles.spinner, className, size === "small" && styles.small)}
      role="status"
      aria-label={label}
    />
  );
}
