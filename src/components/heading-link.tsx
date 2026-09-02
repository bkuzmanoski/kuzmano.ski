import { CopyTooltip } from "#/components/copy-feedback";
import { useCopyToClipboard } from "#/lib/hooks/use-copy-to-clipboard";
import { isBrowserHandledClick } from "#/lib/link";
import { canonicalUrl } from "#/metadata";

import { useArticle } from "../content/article-context";

import styles from "./heading-link.module.css";

import type { ComponentProps } from "react";

const LABEL = "Copy link";
const CONFIRMATION = "Copied";

/** The link appended to each heading, which copies the section's address instead of navigating to it. */
export function HeadingLink({ href, children, ...props }: ComponentProps<"a"> & { href: string }) {
  const article = useArticle();
  const { state, copy, clearConfirmation } = useCopyToClipboard({ onFailure: () => article?.reportCopyFailure() });
  const isCopied = state === "copied";

  return (
    <CopyTooltip
      label={LABEL}
      confirmation={CONFIRMATION}
      margin={2}
      isCopied={isCopied}
      suppressed={article === null} // Nothing to copy without a route to build the link from.
      onDidHide={clearConfirmation}
    >
      <a
        href={href}
        className={styles.headingLink}
        {...props}
        onClick={(event) => {
          if (isBrowserHandledClick(event) || article === null) {
            return;
          }

          event.preventDefault();
          void copy(canonicalUrl(article.route) + href);
        }}
      >
        {children}
      </a>
    </CopyTooltip>
  );
}
