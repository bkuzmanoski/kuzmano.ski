import { useRef } from "react";

import { usePressSound } from "#/lib/audio/use-press-sound.ts";
import { cx } from "#/lib/class-names.ts";
import type { InputFieldBinding } from "#/lib/forms/use-input-field.ts";

import styles from "./input-field.module.css";

import type { MouseEvent, PointerEvent, ReactNode, SyntheticEvent } from "react";

const INPUT_FIELD_SURFACES = "label, input, textarea";

/**
 * Restricts a press handler to the field's own surfaces. A field can also contain a control that plays its own press
 * sound, such as the `Scrollbar` paired with a `TextArea`, which would otherwise play a second sound for the same
 * press.
 */
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
  const pressSoundHandlers = usePressSound({ defersTouchPressSound: true });
  const forwardedClickTargetRef = useRef<HTMLElement | null>(null);

  function onPointerDown(event: PointerEvent) {
    // Clicking a label causes the browser to dispatch a second `click` on its control, with the same `detail`, in
    // Chrome. Since the label click already settles the press, ignore the forwarded click to avoid playing a sound
    // without a matching press. Clear the expected click on the next press because label clicks are not always
    // forwarded (e.g., when a handler prevents their default action).
    forwardedClickTargetRef.current = null;
    onInputFieldSurface(pressSoundHandlers.onPointerDown)(event);
  }

  function onClick(event: MouseEvent) {
    if (event.target === forwardedClickTargetRef.current) {
      forwardedClickTargetRef.current = null;
      return;
    }

    const control = (event.target as Element).closest("label")?.control;

    forwardedClickTargetRef.current = control && !control.matches(":disabled") ? control : null; // A disabled control does not receive a forwarded click.

    onInputFieldSurface(pressSoundHandlers.onClick)(event);
  }

  return (
    <div
      className={cx(styles.inputField, className)}
      onPointerDown={onPointerDown}
      onMouseDown={onInputFieldSurface(pressSoundHandlers.onMouseDown)}
      onPointerCancel={pressSoundHandlers.onPointerCancel}
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

export function StaticField({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    // Use a `<div>` as `children` may render a `<dialog>` (e.g., a `CopyButton` failure alert), which cannot be nested
    // inside a `<p>`.
    <div className={styles.inputField}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {children}
    </div>
  );
}
