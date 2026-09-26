import { useEffect, useRef } from "react";
import { preload } from "react-dom";

import { startAboutPageHeaderAnimation } from "./about-page-header-animation.ts";
import styles from "./about-page-header.module.css";

import type { ReactNode } from "react";

export function AboutPageHeader({ src, alt, children }: { src: string; alt: string; children: ReactNode }) {
  const headerRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);

  preload(src, { as: "image" });

  useEffect(() => {
    const header = headerRef.current;
    const canvas = canvasRef.current;
    const column = columnRef.current;

    if (!header || !canvas || !column) {
      return;
    }

    return startAboutPageHeaderAnimation({ header, canvas, column }, src);
  }, [src]);

  return (
    <header ref={headerRef} className={styles.header} data-content-default-styles="off" data-content-span="pane">
      <canvas ref={canvasRef} className={styles.ditherField} role="img" aria-label={alt} />
      <div ref={columnRef} className={styles.column}>
        <div className={styles.content}>{children}</div>
      </div>
    </header>
  );
}
