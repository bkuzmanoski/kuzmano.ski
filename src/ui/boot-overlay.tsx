import clsx from "clsx";
import { useEffect, useState } from "react";

import styles from "./boot-overlay.module.css";
import { MacFrame } from "./mac-frame";

const BOOT_MS = 1800;
const ZOOM_MS = 700;
const HAS_BOOTED_KEY = "has-booted";
const BOOT_ATTRIBUTE = "data-boot";

const shouldBoot = () => window.location.pathname === "/" && !sessionStorage.getItem(HAS_BOOTED_KEY);

/**
 * Inline script for the document head. It runs before first paint — earlier than
 * React can hydrate — and, when the boot is due, marks <html> so CSS paints an
 * opaque cover immediately. Without it the server-rendered desktop would flash
 * for a frame before the (client-only) overlay below mounts over it.
 */
export const bootOverlayScript = `(function () {
  try {
    if (location.pathname === "/" && !sessionStorage.getItem("${HAS_BOOTED_KEY}")) {
      document.documentElement.setAttribute("${BOOT_ATTRIBUTE}", "");
      setTimeout(function () {
        document.documentElement.removeAttribute("${BOOT_ATTRIBUTE}");
      }, 4000);
    }
  } catch (e) {}
})();`;

type Phase = "pending" | "booting" | "zooming" | "done";

export function BootOverlay() {
  const [phase, setPhase] = useState<Phase>("pending");

  useEffect(() => {
    if (!shouldBoot()) {
      setPhase("done");
      return;
    }

    sessionStorage.setItem(HAS_BOOTED_KEY, "1");
    document.documentElement.removeAttribute(BOOT_ATTRIBUTE);
    setPhase("booting");

    const toZoom = setTimeout(() => setPhase("zooming"), BOOT_MS);
    const toDone = setTimeout(() => setPhase("done"), BOOT_MS + ZOOM_MS);

    return () => {
      clearTimeout(toZoom);
      clearTimeout(toDone);
    };
  }, []);

  if (phase === "pending" || phase === "done") {
    return null;
  }

  return (
    <div className={clsx(styles.overlay, phase === "zooming" && styles.zooming)} aria-hidden>
      <div className={styles.stage}>
        <MacFrame>
          <div className={styles.boot}>
            <div className={styles.face}>☺</div>
            <p className={styles.welcome}>Welcome to Macintosh</p>
          </div>
        </MacFrame>
      </div>
    </div>
  );
}
