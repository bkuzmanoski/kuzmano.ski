import { cx } from "#/lib/class-names.ts";
import type { StyleWithVars } from "#/lib/style.ts";

import styles from "./dither-dissolve.module.css";

import type { ComponentProps } from "react";

type DitherDissolveTextUnit = "character" | "word";

interface DitherDissolveTextPart {
  text: string;
  /** `null` for whitespace between units. */
  unitIndex: number | null;
}

const GRAPHEME_SEGMENTER = new Intl.Segmenter("und", { granularity: "grapheme" });

const unitStyleOf = (unitIndex: number): StyleWithVars => ({ "--dither-dissolve-unit-index": unitIndex });

function ditherDissolveTextPartsOf(text: string, by: DitherDissolveTextUnit): Array<DitherDissolveTextPart> {
  const parts: Array<DitherDissolveTextPart> = [];

  let unitCount = 0;

  for (const whitespaceOrWord of text.split(/(\s+)/u)) {
    if (whitespaceOrWord.trim() === "") {
      parts.push({ text: whitespaceOrWord, unitIndex: null });
    } else {
      const units =
        by === "word"
          ? [whitespaceOrWord]
          : Array.from(GRAPHEME_SEGMENTER.segment(whitespaceOrWord), ({ segment }) => segment);

      for (const unit of units) {
        parts.push({ text: unit, unitIndex: unitCount });
        unitCount += 1;
      }
    }
  }

  return parts;
}

/**
 * Reveals its children as a single unit through Bayer matrix levels on mount. The CSS animation begins at first paint
 * without JavaScript. Children remain solid when reduced motion is preferred and when printed.
 */
export function DitherDissolve({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cx(styles.dissolve, className)} />;
}

/** Reveals text like `DitherDissolve`, staggering each character or word. */
export function DitherDissolveText({
  children,
  by = "character",
  ...props
}: Omit<ComponentProps<"span">, "children"> & { children: string; by?: DitherDissolveTextUnit }) {
  return (
    <span {...props}>
      <span className={styles.accessibleText} data-text={children} data-feed-text={children} />
      <span className={by === "word" ? styles.wordUnits : styles.characterUnits} aria-hidden="true" data-feed-omit>
        {ditherDissolveTextPartsOf(children, by).map(({ text, unitIndex }, partIndex) =>
          unitIndex === null ? (
            text
          ) : (
            <span key={partIndex} className={styles.dissolve} style={unitStyleOf(unitIndex)}>
              {text}
            </span>
          ),
        )}
      </span>
    </span>
  );
}
