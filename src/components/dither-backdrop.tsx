import { useEffect, useRef } from "react";

import { cx } from "#/lib/class-names.ts";

import { startDitherBackdropAnimation } from "./dither-backdrop-animation.ts";
import styles from "./dither-backdrop.module.css";

import type { ComponentProps } from "react";

export function DitherBackdrop({ className, children, ...props }: Omit<ComponentProps<"div">, "ref">) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;

    if (!container || !canvas) {
      return;
    }

    return startDitherBackdropAnimation({ container, canvas });
  }, []);

  return (
    <div {...props} ref={containerRef} className={cx(styles.container, className)}>
      <canvas ref={canvasRef} className={styles.ditherField} aria-hidden="true" />
      {children}
    </div>
  );
}
