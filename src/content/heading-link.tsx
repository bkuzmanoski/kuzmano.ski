import { CopyTooltip } from "#/components/copy-feedback";
import { canonicalUrl } from "#/config/site";
import { useCopyToClipboard } from "#/lib/hooks/use-copy-to-clipboard";
import { isBrowserHandledClick } from "#/lib/link";

import { useArticle } from "./article-context";

import type { ComponentProps } from "react";

const LABEL = "Copy link";
const CONFIRMATION = "Copied";

/**
 * The link appended to each heading, which copies the section's address instead of navigating to it.
 *
 * A reader who clicks a heading is already at that section, so the click is handled by copying the
 * address. The `href` remains so the browser can still open the section in a new tab.
 *
 * The tooltip describes the copy action to both sighted and assistive-technology users while
 * leaving the link's accessible name to describe where it leads. A failed copy is reported to the
 * article's alert rather than to a separate alert on each heading.
 */
export function HeadingLink({ href, children, ...props }: ComponentProps<"a"> & { href: string }) {
  const article = useArticle();
  const { state, copy, clearConfirmation } = useCopyToClipboard({ onFailure: () => article?.reportCopyFailure() });
  const isCopied = state === "copied";

  return (
    <CopyTooltip
      label={LABEL}
      confirmation={CONFIRMATION}
      isCopied={isCopied}
      suppressed={article === null} // Nothing to copy without a route to build the link from.
      onDidHide={clearConfirmation}
    >
      <a
        href={href}
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
