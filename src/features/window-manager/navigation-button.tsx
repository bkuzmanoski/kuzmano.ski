import ChevronButtonIcon from "#/assets/images/button-icon-chevron.svg?react";
import { Button } from "#/components/button.tsx";
import { Tooltip } from "#/components/tooltip.tsx";
import { cx } from "#/lib/class-names.ts";
import { openInAppOnPlainClick } from "#/lib/link.ts";
import { useWindowActions } from "#/lib/window-manager/context.ts";

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
    <ChevronButtonIcon
      className={cx(
        styles.chevronButtonIcon,
        variant === "previous" && styles.previous,
        variant === "next" && styles.next,
      )}
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
          href={route}
          aria-label={label}
          onClick={(event) => openInAppOnPlainClick(event, () => open(route))}
        >
          {icon}
        </Button>
      )}
    </Tooltip>
  );
}
