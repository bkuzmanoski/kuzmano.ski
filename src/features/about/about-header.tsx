import { useRef } from "react";

import { DitherBackdrop } from "#/components/dither-backdrop.tsx";

import styles from "./about-header.module.css";
import { Avatar } from "./avatar.tsx";

import type { ReactNode } from "react";

export function AboutHeader({ speech, children }: { speech?: string; children: ReactNode }) {
  const graphicRef = useRef<SVGSVGElement>(null);
  return (
    <header className={styles.header} data-content-span="pane">
      <DitherBackdrop className={styles.backdrop} highlightCenterRef={graphicRef}>
        <Avatar speech={speech} className={styles.avatar} graphicRef={graphicRef} />
      </DitherBackdrop>
      {children}
    </header>
  );
}
