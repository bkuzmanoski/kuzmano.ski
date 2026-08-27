import ArrowIcon from "#/assets/images/arrow.svg?react";
import { Button } from "#/components/button";
import { Tooltip } from "#/components/tooltip";
import { cx } from "#/lib/class-names";
import { isBrowserHandledClick } from "#/lib/link";
import { useWindowActions } from "#/lib/window-manager";

import styles from "./navigation-button.module.css";

export function NavigationButton({
  label,
  variant,
  route,
  className,
}: {
  label: string;
  variant: "previous" | "next";
  route: string | null;
  className?: string;
}) {
  const { open } = useWindowActions();
  const icon = (
    <ArrowIcon
      className={cx(styles.icon, variant === "previous" && styles.previous, variant === "next" && styles.next)}
    />
  );

  return (
    <Tooltip label={label} suppressed={route === null} className={className}>
      {route === null ? (
        <Button variant="icon" aria-label={label} disabled>
          {icon}
        </Button>
      ) : (
        <Button
          variant="icon"
          aria-label={label}
          href={route}
          onClick={(event) => {
            if (isBrowserHandledClick(event)) {
              return;
            }

            event.preventDefault();
            open(route);
          }}
        >
          {icon}
        </Button>
      )}
    </Tooltip>
  );
}
