import { playClick } from "#/lib/audio/sounds";
import { cx } from "#/lib/class-names";
import { mergeHandlers } from "#/lib/merge-handlers";
import { mergeRefs } from "#/lib/merge-refs";

import styles from "./button.module.css";

import type { ComponentProps, ReactElement, SVGProps } from "react";

/**
 * Renders a `<button>`, or an `<a>` when an `href` is supplied.
 *
 * `holdPressed` adds the pressed appearance for controls whose press outlives `:active`.
 */
export function Button(
  props: (
    | { variant?: "label"; children: string }
    | { variant: "icon"; children: ReactElement<SVGProps<SVGSVGElement>>; "aria-label": string }
  ) & { holdPressed?: boolean } & (
      | (Omit<ComponentProps<"button">, "children"> & { href?: undefined })
      | (Omit<ComponentProps<"a">, "children"> & { href: string })
    ),
) {
  const className = cx(
    styles.button,
    props.variant === "icon" && styles.icon,
    props.holdPressed && styles.pressed,
    props.className,
  );

  if (props.href !== undefined) {
    const { children, autoFocus, ref, variant: _variant, holdPressed: _holdPressed, ...linkProps } = props;

    return (
      <a
        ref={mergeRefs(ref, (node) => {
          if (autoFocus) {
            node?.focus(); // Manual focus as React does not apply `autoFocus` to anchors.
          }
        })}
        className={className}
        {...mergeHandlers({ onPointerDown: playClick }, linkProps)}
      >
        {children}
      </a>
    );
  }

  const { children, type = "button", variant: _variant, holdPressed: _holdPressed, ...buttonProps } = props;

  return (
    <button type={type} className={className} {...mergeHandlers({ onPointerDown: playClick }, buttonProps)}>
      {children}
    </button>
  );
}
