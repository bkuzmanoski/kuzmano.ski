import styles from "./copy-announcer.module.css";

/** The confirmation a copy control shows and its `CopyAnnouncer` announces, unless the control names its own. */
export const COPY_CONFIRMATION = "Copied";

/**
 * The live status region that announces copies for one `useCopyToClipboard`. Keying the node by
 * `confirmedClipboardCopyNumber` makes a screen reader announce each new copy as an insertion while leaving the node
 * intact during a confirmation.
 *
 * Every second confirmation ends in a no-break space, as VoiceOver skips text identical to the region's previous
 * announcement even after the region is emptied, and does not read the no-break space.
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
