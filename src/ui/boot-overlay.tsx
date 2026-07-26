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
 * This inline script goes in the document head. It runs before the first paint,
 * which is earlier than React can hydrate. If the boot is due, the script marks
 * <html>. The CSS then paints an opaque cover immediately.
 *
 * Without this script, the browser shows the server-rendered desktop prior to
 * hydration. The overlay below is client-only and mounts after hydration.
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
