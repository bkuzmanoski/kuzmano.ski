import clsx from "clsx";

import WatchIcon from "#/assets/images/spinner.svg?react";

import styles from "./spinner.module.css";

/**
 * A System 6-era watch, its minute hand ticking clockwise to mark time passing.
 *
 * The watch takes its color from `currentColor`; `--step-ms` sets how long each
 * position of the hand is held for. Caller can set each via `className`.
 */
export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return <WatchIcon className={clsx(styles.spinner, className)} role="status" aria-label={label} />;
}
