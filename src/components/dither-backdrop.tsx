import { useEffect, useRef } from "react";

import { cx } from "#/lib/class-names.ts";
import { startDitherBackdropAnimation } from "#/lib/dither/backdrop-animation.ts";
import { mergeRefs } from "#/lib/merge-refs.ts";
import { useIsWindowRevealed } from "#/lib/window-manager/use-is-window-revealed.ts";

import styles from "./dither-backdrop.module.css";

import type { ComponentProps, RefObject } from "react";

export function DitherBackdrop({
  highlightCenterRef,
  className,
  children,
  ref,
  ...props
}: ComponentProps<"div"> & { highlightCenterRef?: RefObject<Element | null> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isWindowRevealed = useIsWindowRevealed();

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;

    if (!isWindowRevealed || !container || !canvas) {
      return;
    }

    return startDitherBackdropAnimation({
      container,
      canvas,
      highlightCenterElement: highlightCenterRef?.current ?? null,
    });
  }, [isWindowRevealed, highlightCenterRef]);

  return (
    <div {...props} ref={mergeRefs(ref, containerRef)} className={cx(styles.container, className)}>
      <canvas ref={canvasRef} className={styles.ditherField} aria-hidden="true" />
      {children}
    </div>
  );
}
