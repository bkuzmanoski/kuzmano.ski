import { isValidElement, useId, useRef } from "react";

import GitHubGistButtonIcon from "#/assets/images/button-icon-github-gist.svg?react";
import { Button } from "#/components/button.tsx";
import { ControlledCopyButton } from "#/components/copy-button.tsx";
import { Tooltip } from "#/components/tooltip.tsx";
import { GITHUB_GIST_LINK_TEXT } from "#/config/site.ts";
import { cx } from "#/lib/class-names.ts";
import { useIsHydrated } from "#/lib/hooks/use-client-value.ts";
import { githubGistUrlOf } from "#/site/github-gists.ts";

import styles from "./code-block.module.css";
import { useEntryClipboard } from "./entry-clipboard.ts";
import { useOpensInNewTabDescriptionId } from "./opens-in-new-tab-description.ts";

import type { ComponentProps, ReactNode } from "react";

const LANGUAGE_CLASS_NAME_PREFIX = "language-";

function languageOf(children: ReactNode): string | null {
  if (!isValidElement<{ className?: string }>(children)) {
    return null;
  }

  const languageClassName = children.props.className
    ?.split(/\s+/)
    .find((name) => name.startsWith(LANGUAGE_CLASS_NAME_PREFIX) && name.length > LANGUAGE_CLASS_NAME_PREFIX.length);

  return languageClassName?.slice(LANGUAGE_CLASS_NAME_PREFIX.length) ?? null;
}

/**
 * Renders a code block with a copy control and, when `data-gist-id` is present, a GitHub Gist link.
 *
 * Copy text is read from the rendered `<pre>` on demand. Passing it as a prop would duplicate each
 * block's text because the highlighter already renders it as styled spans (see `/build/content/mdx.ts`).
 */
export function CodeBlock({
  style,
  "data-gist-id": gistId,
  ...props
}: ComponentProps<"pre"> & { "data-gist-id"?: string }) {
  const preRef = useRef<HTMLPreElement>(null);
  const copyControlId = useId();
  const entryClipboard = useEntryClipboard();
  const opensInNewTabDescriptionId = useOpensInNewTabDescriptionId();
  const isHydrated = useIsHydrated();
  const language = languageOf(props.children);
  const gistUrl = gistId === undefined ? null : githubGistUrlOf(gistId);

  return (
    <div
      className={cx(styles.codeBlock, gistId !== undefined && styles.gist)}
      style={style}
      data-content-panel
      data-content-default-styles="off"
    >
      <div className={styles.header}>
        <span className={styles.languageLabel} data-feed-omit>
          {language}
        </span>
        <div className={styles.controls}>
          {gistUrl !== null && (
            <Tooltip label={GITHUB_GIST_LINK_TEXT} className={styles.control}>
              <Button
                variant="strip"
                href={gistUrl}
                target="_blank"
                aria-label={GITHUB_GIST_LINK_TEXT}
                aria-describedby={opensInNewTabDescriptionId}
                data-feed-text={`${GITHUB_GIST_LINK_TEXT}.`}
              >
                <GitHubGistButtonIcon />
              </Button>
            </Tooltip>
          )}
          <ControlledCopyButton
            copyStatus={entryClipboard?.copyStatusOf(copyControlId) ?? null}
            disabled={!isHydrated || entryClipboard === null}
            announcesConfirmation={false}
            variant="strip"
            className={styles.control}
            onCopy={() => entryClipboard?.copyToClipboard(copyControlId, preRef.current?.textContent ?? "", "code")}
            onDidHide={() => entryClipboard?.clearCopyConfirmationOf(copyControlId)}
          />
        </div>
      </div>
      <pre ref={preRef} {...props} data-content-default-styles="on" />
    </div>
  );
}
