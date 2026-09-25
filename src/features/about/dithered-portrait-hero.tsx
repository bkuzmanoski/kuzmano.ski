import { useEffect, useRef } from "react";
import { preload } from "react-dom";

import { startDitheredPortraitHeroAnimation } from "./dithered-portrait-hero-animation.ts";
import styles from "./dithered-portrait-hero.module.css";

import type { ReactNode } from "react";

export function DitheredPortraitHero({ src, alt, children }: { src: string; alt: string; children: ReactNode }) {
  const heroRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);

  preload(src, { as: "image" });

  useEffect(() => {
    const hero = heroRef.current;
    const canvas = canvasRef.current;
    const column = columnRef.current;

    if (!hero || !canvas || !column) {
      return;
    }

    return startDitheredPortraitHeroAnimation({ hero, canvas, column }, src);
  }, [src]);

  return (
    <section ref={heroRef} className={styles.hero} data-content-default-styles="off" data-content-full-bleed>
      <canvas ref={canvasRef} className={styles.ditherField} role="img" aria-label={alt} />
      <div ref={columnRef} className={styles.column}>
        {/* A `div`, because MDX wraps a multi-line statement in a paragraph of its own. */}
        <div className={styles.statement}>{children}</div>
      </div>
    </section>
  );
}
