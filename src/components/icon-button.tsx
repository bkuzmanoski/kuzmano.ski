import { Button } from "./button.tsx";
import { Tooltip } from "./tooltip.tsx";

import type { IconButtonVariant } from "./button.tsx";
import type { ComponentProps, ReactElement, SVGProps } from "react";

type IconButtonProps = {
  label: string;
  variant: IconButtonVariant;
  holdPressed?: boolean;
  className?: string;
  children: ReactElement<SVGProps<SVGSVGElement>>;
} & (
  | (Omit<ComponentProps<"button">, "children" | "className" | "aria-label"> & { href?: undefined })
  | (Omit<ComponentProps<"a">, "children" | "className" | "aria-label"> & { href: string })
);

export function IconButton({ label, className, ...buttonProps }: IconButtonProps) {
  return (
    <Tooltip
      label={label}
      suppressed={buttonProps.href === undefined ? buttonProps.disabled : undefined}
      className={className}
    >
      <Button {...buttonProps} aria-label={label} />
    </Tooltip>
  );
}
