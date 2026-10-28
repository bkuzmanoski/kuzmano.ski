import { useRef } from "react";

import { usePressSound } from "#/lib/audio/use-press-sound.ts";
import { cx } from "#/lib/class-names.ts";
import type { InputFieldBinding } from "#/lib/forms/use-input-field.ts";

import styles from "./input-field.module.css";

import type { MouseEvent, PointerEvent, ReactNode, SyntheticEvent } from "react";

const INPUT_FIELD_SURFACES = "label, input, textarea";

// Restricts a press handler to the field's own surfaces. A field can also contain a control
// that plays its own press sound, such as the `Scrollbar` paired with a `TextArea`, which
// would otherwise play a second sound for the same press.
function onInputFieldSurface<T extends SyntheticEvent>(handler: (event: T) => void) {
  return (event: T) => {
    if ((event.target as Element).closest(INPUT_FIELD_SURFACES)) {
      handler(event);
    }
  };
}

export function InputField({
  label,
  binding,
  labelHidden = false,
  className,
  children,
}: {
  label: string;
  binding: InputFieldBinding;
  labelHidden?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const pressSound = usePressSound({ scrollSafe: true });
  const forwardedClickTargetRef = useRef<HTMLElement | null>(null);

  function onPointerDown(event: PointerEvent) {
    // Clicking a label causes the browser to dispatch a second `click` on its control, with the same
    // `detail`, in Chrome. Since the label click already settles the press, ignore the forwarded click to
    // avoid playing a sound without a matching press. Clear the expected click on the next press because
    // label clicks are not always forwarded (for example, when their default action is prevented).
    forwardedClickTargetRef.current = null;
    onInputFieldSurface(pressSound.onPointerDown)(event);
  }

  function onClick(event: MouseEvent) {
    if (event.target === forwardedClickTargetRef.current) {
      forwardedClickTargetRef.current = null;
      return;
    }

    const control = (event.target as Element).closest("label")?.control;

    forwardedClickTargetRef.current = control && !control.matches(":disabled") ? control : null; // A disabled control does not receive a forwarded click.

    onInputFieldSurface(pressSound.onClick)(event);
  }

  return (
    <div
      className={cx(styles.inputField, className)}
      onPointerDown={onPointerDown}
      onPointerCancel={pressSound.onPointerCancel}
      onClick={onClick}
    >
      <label className={labelHidden ? styles.hidden : styles.label} htmlFor={binding.control.id}>
        {label}
      </label>
      {children}
      <p className={styles.error} id={binding.errorId}>
        {binding.error}
      </p>
    </div>
  );
}
