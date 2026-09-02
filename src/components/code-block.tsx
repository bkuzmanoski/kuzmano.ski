import { useEffect, useRef, useState } from "react";

import { CopyButton } from "#/components/copy-button";

import styles from "./code-block.module.css";

import type { ComponentProps } from "react";

/**
 * A code block paired with a control that copies its source.
 *
 * The source is read back out of the rendered block rather than carried alongside it: the
 * highlighter has already split it into styled spans (see `/build/mdx.ts`), and passing it
 * as a prop would render every block's text in the document twice. It is read after mount
 * so the copy control is disabled until hydration.
 */
export function CodeBlock(props: ComponentProps<"pre">) {
  const preRef = useRef<HTMLPreElement>(null);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    setSource(preRef.current?.textContent ?? null);
  }, []);

  return (
    <div className={styles.codeBlock}>
      <pre ref={preRef} {...props} />
      <CopyButton value={source} entity="code" className={styles.copyButton} />
    </div>
  );
}
