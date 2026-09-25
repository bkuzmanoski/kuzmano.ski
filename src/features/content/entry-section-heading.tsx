import { Children, isValidElement, useId } from "react";

import { CopyTooltip } from "#/components/copy-tooltip.tsx";
import { playClick } from "#/lib/audio/sounds.ts";
import { useRenderedEntry } from "#/lib/content/rendered-entry.ts";
import { isBrowserHandledClick } from "#/lib/link.ts";
import type { StyleWithVars } from "#/lib/style.ts";
import { canonicalUrl } from "#/site/metadata.ts";

import { useEntryClipboard } from "./entry-clipboard.ts";
import styles from "./entry-section-heading.module.css";

import type { ComponentProps, ReactElement, ReactNode } from "react";

type HeadingLevel = 2 | 3; // The levels an entry can use (see `heading-levels` in `/content/.markdownlint-cli2.jsonc`).
type HeadingLinkElement = ReactElement<{ "data-heading-link": string; href?: string }>; // The link the build appends to a heading, marked `data-heading-link`, whose `href` is the heading's fragment.

const isHeadingLinkElement = (child: ReactNode): child is HeadingLinkElement =>
  isValidElement<{ "data-heading-link"?: string }>(child) && child.props["data-heading-link"] !== undefined;

function HeadingLink({
  fragment,
  headingId,
  level,
  anchorStyle,
}: {
  fragment: string;
  headingId: string;
  level: HeadingLevel;
  anchorStyle: StyleWithVars;
}) {
  const labelStartId = useId();
  const labelEndId = useId();
  const renderedEntry = useRenderedEntry();
  const entryClipboard = useEntryClipboard();

  const isCopied = entryClipboard?.copyStatusOf(fragment) === "copied";

  return (
    <span className={styles.headingLinkPosition} style={anchorStyle} data-heading-level={level} data-feed-omit>
      <CopyTooltip
        label={"Copy link"}
        confirmation={"Copied"}
        margin={2}
        isCopied={isCopied}
        suppressed={renderedEntry === null || entryClipboard === null}
        announcesConfirmation={false}
        onDidHide={() => entryClipboard?.clearCopyConfirmationOf(fragment)}
      >
        <a
          href={fragment}
          className={styles.headingLink}
          aria-labelledby={`${labelStartId} ${headingId} ${labelEndId}`}
          data-heading-link
          onClick={(event) => {
            if (isBrowserHandledClick(event) || renderedEntry === null || entryClipboard === null) {
              return;
            }

            event.preventDefault();
            playClick();
            entryClipboard.copyToClipboard(fragment, canonicalUrl(renderedEntry.route) + fragment, "link");
          }}
        >
          <span id={labelStartId} hidden>
            Copy link to
          </span>
          <span aria-hidden="true">#</span>
          <span id={labelEndId} hidden>
            section
          </span>
        </a>
      </CopyTooltip>
    </span>
  );
}

export function EntrySectionHeading({ level, id, children, ...props }: ComponentProps<"h2"> & { level: HeadingLevel }) {
  const anchorName = `--heading-link-${useId().replace(/[^\w-]/g, "")}`;
  const Heading = `h${level}` as const;
  const headingChildren = Children.toArray(children);
  const headingLinkChild = headingChildren.find(isHeadingLinkElement);
  const fragment = headingLinkChild?.props.href;

  if (fragment === undefined || id === undefined) {
    return (
      <Heading id={id} {...props} tabIndex={-1}>
        {children}
      </Heading>
    );
  }

  const anchorStyle: StyleWithVars = { "--heading-link-anchor": anchorName };

  return (
    <>
      <Heading id={id} {...props} tabIndex={-1}>
        {headingChildren.filter((child) => child !== headingLinkChild)}
        <span className={styles.headingLinkSlot} style={anchorStyle} aria-hidden="true" data-feed-omit />
      </Heading>
      <HeadingLink fragment={fragment} headingId={id} level={level} anchorStyle={anchorStyle} />
    </>
  );
}
