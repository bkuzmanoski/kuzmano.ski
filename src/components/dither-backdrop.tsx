import { useEffect, useRef } from "react";

import { cx } from "#/lib/class-names.ts";
import { useIsWindowRevealed } from "#/lib/window-manager/use-is-window-revealed.ts";

import { startDitherBackdropAnimation } from "./dither-backdrop-animation.ts";
import styles from "./dither-backdrop.module.css";

import type { ComponentProps } from "react";

export function DitherBackdrop({ className, children, ...props }: Omit<ComponentProps<"div">, "ref">) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isWindowRevealed = useIsWindowRevealed();

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;

    if (!isWindowRevealed || !container || !canvas) {
      return;
    }

    return startDitherBackdropAnimation({ container, canvas });
  }, [isWindowRevealed]);

  return (
    <div {...props} ref={containerRef} className={cx(styles.container, className)}>
      <canvas ref={canvasRef} className={styles.ditherField} aria-hidden="true" />
      {children}
    </div>
  );
}
