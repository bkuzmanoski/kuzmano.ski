import { mergeRefs } from "#/lib/merge-refs";

import styles from "./button.module.css";

import type { ComponentProps } from "react";

/** Renders a `<button>`, or an `<a>` when an `href` is supplied. */
export function Button(
  props: (ComponentProps<"button"> & { href?: undefined }) | (ComponentProps<"a"> & { href: string }),
) {
  if (props.href !== undefined) {
    const { children, autoFocus, ref, ...linkProps } = props;

    return (
      <a
        {...linkProps}
        ref={mergeRefs(ref, (node) => {
          if (autoFocus) {
            node?.focus(); // Manual focus as React does not apply `autoFocus` to anchors.
          }
        })}
        className={styles.button}
      >
        {children}
      </a>
    );
  }

  const { children, ...buttonProps } = props;

  return (
    <button {...buttonProps} type="button" className={styles.button}>
      {children}
    </button>
  );
}
