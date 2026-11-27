import styles from "./copy-announcer.module.css";

/** Default confirmation text shown by copy controls and announced by `CopyAnnouncer`. */
export const COPY_CONFIRMATION = "Copied";

/**
 * Live status region that announces copies for a `useCopyToClipboard` instance. Keying the node by
 * `confirmedClipboardCopyNumber` makes screen readers announce each new copy as an insertion while leaving the node
 * intact during confirmation.
 *
 * Every second confirmation ends in a no-break space, as VoiceOver skips text identical to the region's previous
 * announcement even after it is emptied, and does not read the no-break space.
 */
export function CopyAnnouncer({
  confirmedClipboardCopyNumber,
  confirmation = COPY_CONFIRMATION,
}: {
  confirmedClipboardCopyNumber: number | null;
  confirmation?: string;
}) {
  return (
    <span className={styles.announcer} role="status">
      {confirmedClipboardCopyNumber !== null && (
        <span key={confirmedClipboardCopyNumber}>
          {confirmedClipboardCopyNumber % 2 === 0 ? `${confirmation}\u00A0` : confirmation}
        </span>
      )}
    </span>
  );
}
