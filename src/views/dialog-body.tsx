import { Button } from "#/components/button";
import { cx } from "#/lib/class-names";
import { useDismissWindow } from "#/lib/hooks/use-dismiss-window";

import styles from "./dialog-body.module.css";

const CHAR_INFORMATION_ICON = "💁";
const CHAR_ERROR_ICON = "⯃";

export function DialogBody({
  variant = "information",
  title,
  headingLevel = 2,
  message,
  actions,
  className,
}: {
  variant?: "information" | "error";
  title?: string;
  headingLevel?: 1 | 2;
  message: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  const dismiss = useDismissWindow();

  const Heading = `h${headingLevel}` as const;

  return (
    <article className={cx(styles.dialogBody, className)}>
      <span className={styles.icon} aria-hidden>
        {variant === "information" ? CHAR_INFORMATION_ICON : CHAR_ERROR_ICON}
      </span>
      <div className={styles.message}>
        {title && <Heading className={styles.title}>{title}</Heading>}
        <p>{message}</p>
      </div>
      <div className={styles.actions}>
        {actions ?? (dismiss && <Button children="OK" autoFocus onClick={dismiss} />)}
      </div>
    </article>
  );
}
