import { useState } from "react";

import { usePressSound } from "#/lib/audio/use-press-sound.ts";
import { cx } from "#/lib/class-names.ts";
import { activateOnKeyPress } from "#/lib/keys.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import { mergeRefs } from "#/lib/merge-refs.ts";
import { isPrimaryPress } from "#/lib/press.ts";

import styles from "./button.module.css";

import type { ComponentProps, KeyboardEvent, MouseEvent, PointerEvent, ReactElement, SVGProps } from "react";

export type IconButtonVariant = "standalone" | "strip";

/**
 * Renders a `<button>`, or an `<a>` when an `href` is supplied.
 *
 * `holdPressed` extends the pressed state beyond `:active` for controls whose action is handled
 * asynchronously. When provided, the control remains in the pressed state from `pointerdown`
 * until `click` is handled, closing the gap between `:active` ending on pointer release and the
 * action handler taking effect. Safari renders this gap; Chrome does not.
 *
 * A control with `aria-disabled` remains focusable while behaving as disabled when pressed.
 */
export function Button(
  props: (
    | { variant?: "label"; children: string }
    | { variant: IconButtonVariant; children: ReactElement<SVGProps<SVGSVGElement>>; "aria-label": string }
  ) & { holdPressed?: boolean } & (
      | (Omit<ComponentProps<"button">, "children"> & { href?: undefined })
      | (Omit<ComponentProps<"a">, "children"> & { href: string })
    ),
) {
  const [isPressing, setIsPressing] = useState(false);
  const pressSoundHandlers = usePressSound();

  const className = cx(
    styles.button,
    props.variant === "standalone" && styles.standalone,
    props.variant === "strip" && styles.strip,
    (props.holdPressed || isPressing) && styles.pressed,
    props.className,
  );
  const isAriaDisabled = props["aria-disabled"] === true || props["aria-disabled"] === "true";
  const pressHandlers = isAriaDisabled
    ? { onClick: (event: MouseEvent) => event.preventDefault() }
    : mergeHandlers(pressSoundHandlers, {
        onPointerDown: (event: PointerEvent) => {
          if (props.holdPressed !== undefined && isPrimaryPress(event)) {
            setIsPressing(true);
          }
        },
        onPointerLeave: (event: PointerEvent) => {
          // Leaving while pressed does not trigger a click to clear the pressed state.
          // Taps can also trigger `pointerleave`, but with `buttons` set to zero.
          if (event.buttons !== 0) {
            setIsPressing(false);
          }
        },
        onPointerCancel: () => setIsPressing(false),
        onClick: () => setIsPressing(false),
        onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
          if (props.href !== undefined) {
            const link = event.currentTarget;
            activateOnKeyPress(event, () => link.click());
          }
        },
      });

  if (props.href !== undefined) {
    const {
      children,
      autoFocus,
      ref,
      variant: _variant,
      holdPressed: _holdPressed,
      className: _className, // `className` is merged into the class list above, so it is held back from the props spread.
      onClick,
      ...linkProps
    } = props;
    return (
      <a
        ref={mergeRefs(ref, (node) => {
          if (autoFocus) {
            node?.focus(); // Manual focus as React does not apply `autoFocus` to anchors.
          }
        })}
        className={className}
        {...mergeHandlers(pressHandlers, { ...linkProps, onClick: isAriaDisabled ? undefined : onClick })}
      >
        {children}
      </a>
    );
  }

  const {
    children,
    type = "button",
    variant: _variant,
    holdPressed: _holdPressed,
    className: _className,
    onClick,
    ...buttonProps
  } = props;

  return (
    <button
      type={type}
      className={className}
      {...mergeHandlers(pressHandlers, { ...buttonProps, onClick: isAriaDisabled ? undefined : onClick })}
    >
      {children}
    </button>
  );
}
