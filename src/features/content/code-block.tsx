import { isValidElement, useId, useRef } from "react";

import { ControlledCopyButton } from "#/components/copy-button.tsx";
import { useIsHydrated } from "#/lib/hooks/use-client-value.ts";

import styles from "./code-block.module.css";
import { useEntryClipboard } from "./entry-clipboard.ts";

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
 * A code block paired with a control that copies its source.
 *
 * The source is read out of the rendered block when the control is pressed rather than passed as a
 * prop. The highlighter has already split it into styled spans (see `/build/content/mdx.ts`), so a
 * prop would render every block's text in the document twice.
 */
export function CodeBlock(props: ComponentProps<"pre">) {
  const preRef = useRef<HTMLPreElement>(null);
  const copyControlId = useId();
  const entryClipboard = useEntryClipboard();
  const isHydrated = useIsHydrated();
  const language = languageOf(props.children);

  return (
    <div className={styles.codeBlock} data-content-panel>
      <div className={styles.header} data-feed-omit>
        <span className={styles.languageLabel}>{language}</span>
        <ControlledCopyButton
          copyStatus={entryClipboard?.copyStatusOf(copyControlId) ?? null}
          disabled={!isHydrated || entryClipboard === null}
          announcesConfirmation={false}
          onCopy={() => entryClipboard?.copyToClipboard(copyControlId, preRef.current?.textContent ?? "", "code")}
          onDidHide={() => entryClipboard?.clearCopyConfirmationOf(copyControlId)}
        />
      </div>
      <pre ref={preRef} {...props} />
    </div>
  );
}
