import { playClick } from "#/lib/audio/sounds";
import { cx } from "#/lib/class-names";
import { mergeHandlers } from "#/lib/merge-handlers";
import { mergeRefs } from "#/lib/merge-refs";

import styles from "./button.module.css";

import type { ComponentProps, ReactElement, SVGProps } from "react";

/** Renders a `<button>`, or an `<a>` when an `href` is supplied. */
export function Button(
  props: (
    | { variant?: "label"; children: string }
    | { variant: "icon"; children: ReactElement<SVGProps<SVGSVGElement>>; "aria-label": string }
  ) &
    (
      | (Omit<ComponentProps<"button">, "children"> & { href?: undefined })
      | (Omit<ComponentProps<"a">, "children"> & { href: string })
    ),
) {
  const className = cx(styles.button, props.variant === "icon" && styles.icon, props.className);

  if (props.href !== undefined) {
    const { children, autoFocus, ref, variant: _variant, ...linkProps } = props;

    return (
      <a
        {...mergeHandlers({ onPointerDown: playClick }, linkProps)}
        ref={mergeRefs(ref, (node) => {
          if (autoFocus) {
            node?.focus(); // Manual focus as React does not apply `autoFocus` to anchors.
          }
        })}
        className={className}
      >
        {children}
      </a>
    );
  }

  const { children, type = "button", variant: _variant, ...buttonProps } = props;

  return (
    <button {...mergeHandlers({ onPointerDown: playClick }, buttonProps)} type={type} className={className}>
      {children}
    </button>
  );
}
