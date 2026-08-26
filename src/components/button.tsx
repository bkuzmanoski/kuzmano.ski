import { useState } from "react";

import { usePressSound } from "#/lib/audio/use-press-sound";
import { cx } from "#/lib/class-names";
import { mergeHandlers } from "#/lib/merge-handlers";
import { mergeRefs } from "#/lib/merge-refs";
import { isPrimaryPress } from "#/lib/press";

import styles from "./button.module.css";

import type { ComponentProps, PointerEvent, ReactElement, SVGProps } from "react";

/**
 * Renders a `<button>`, or an `<a>` when an `href` is supplied.
 *
 * `holdPressed` extends the pressed state beyond `:active` for controls whose action is handled
 * asynchronously. When provided, the control remains in the pressed state from `pointerdown`
 * until `click` is handled, closing the gap between `:active` ending on pointer release and the
 * action handler taking effect. Safari renders this gap; Chrome does not.
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
  const [isPressing, setIsPressing] = useState(false);
  const pressSoundHandlers = usePressSound();

  const className = cx(
    styles.button,
    props.variant === "icon" && styles.icon,
    (props.holdPressed || isPressing) && styles.pressed,
    props.className,
  );

  const pressHandlers = mergeHandlers(pressSoundHandlers, {
    onPointerDown: (event: PointerEvent) => {
      // Only controls that handle `holdPressed` need the pressed state.
      if (props.holdPressed !== undefined && isPrimaryPress(event)) {
        setIsPressing(true);
      }
    },
    // A pointer leaving the control's bounds while pressed will not produce a click to clear
    // the pressed state. A tap can also produce `pointerleave`, but `buttons` is zero.
    onPointerLeave: (event: PointerEvent) => {
      if (event.buttons !== 0) {
        setIsPressing(false);
      }
    },
    onPointerCancel: () => setIsPressing(false),
    onClick: () => setIsPressing(false),
  });

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
        {...mergeHandlers(pressHandlers, linkProps)}
      >
        {children}
      </a>
    );
  }

  const { children, type = "button", variant: _variant, holdPressed: _holdPressed, ...buttonProps } = props;

  return (
    <button type={type} className={className} {...mergeHandlers(pressHandlers, buttonProps)}>
      {children}
    </button>
  );
}
