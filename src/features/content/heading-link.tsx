import { CopyTooltip } from "#/components/copy-tooltip.tsx";
import { useRenderedEntry } from "#/lib/content/rendered-entry.ts";
import { useCopyToClipboard } from "#/lib/hooks/use-copy-to-clipboard.ts";
import { isBrowserHandledClick } from "#/lib/link.ts";
import { canonicalUrl } from "#/site/metadata.ts";

import styles from "./heading-link.module.css";

import type { ComponentProps } from "react";

const LABEL = "Copy link";
const CONFIRMATION = "Copied";

/** The link appended to each heading, which copies the section's address instead of navigating to it. */
export function HeadingLink({ href, children, ...props }: ComponentProps<"a"> & { href: string }) {
  const renderedEntry = useRenderedEntry();
  const { state, copy, clearConfirmation } = useCopyToClipboard({
    onFailure: () => renderedEntry?.reportCopyFailure(),
  });
  const isCopied = state === "copied";

  return (
    <CopyTooltip
      label={LABEL}
      confirmation={CONFIRMATION}
      margin={2}
      isCopied={isCopied}
      suppressed={renderedEntry === null} // Nothing to copy without a route to build the link from.
      onDidHide={clearConfirmation}
    >
      <a
        href={href}
        className={styles.headingLink}
        {...props}
        onClick={(event) => {
          if (isBrowserHandledClick(event) || renderedEntry === null) {
            return;
          }

          event.preventDefault();
          void copy(canonicalUrl(renderedEntry.route) + href);
        }}
      >
        {children}
      </a>
    </CopyTooltip>
  );
}
