import clsx from "clsx";

import type { StyleWithVars } from "#/lib/style";

import styles from "./spinner.module.css";

/* The blocks of the ring, clockwise from the left of its top edge, defined
 * as lines on the five by five grid laid out by the stylesheet. */
const RING: ReadonlyArray<StyleWithVars> = [
  { row: 1, column: 2 },
  { row: 1, column: 3 },
  { row: 1, column: 4 },
  { row: 2, column: 5 },
  { row: 3, column: 5 },
  { row: 4, column: 5 },
  { row: 5, column: 4 },
  { row: 5, column: 3 },
  { row: 5, column: 2 },
  { row: 4, column: 1 },
  { row: 3, column: 1 },
  { row: 2, column: 1 },
].map(({ row, column }, index) => ({ gridArea: `${row} / ${column}`, "--block-index": index }));

/**
 * A ring of blocks with a bright head sweeping around it.
 *
 * Each blocks takes its color from `currentcolor`; `--block-size` sets
 * how large they are. Caller can set each via `className`.
 */
export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <div className={clsx(styles.spinner, className)} role="status" aria-label={label}>
      {RING.map((blockStyle) => (
        <span key={blockStyle.gridArea} style={blockStyle} />
      ))}
    </div>
  );
}
