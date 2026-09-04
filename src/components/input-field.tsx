import { usePressSound } from "#/lib/audio/use-press-sound.ts";
import { cx } from "#/lib/class-names.ts";
import type { InputFieldBinding } from "#/lib/forms/use-input-field.ts";

import styles from "./input-field.module.css";

import type { ReactNode, SyntheticEvent } from "react";

const INPUT_FIELD_SURFACES = "label, input, textarea";

// Restricts a press handler to the field's own surfaces. A field can also hold a control that
// plays its own press sound, such as the `Scrollbar` paired with a `TextArea`, which would
// otherwise play a second sound for the same press.
function onInputFieldSurface<T extends SyntheticEvent>(handler: (event: T) => void) {
  return (event: T) => {
    if ((event.target as Element).closest(INPUT_FIELD_SURFACES)) {
      handler(event);
    }
  };
}

export function InputFieldValue({
  label,
  actions,
  children,
}: {
  label: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.inputField}>
      <span className={styles.label}>{label}</span>
      <p className={styles.value}>{children}</p>
      {actions}
    </div>
  );
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

  return (
    <div
      className={cx(styles.inputField, className)}
      onPointerDown={onInputFieldSurface(pressSound.onPointerDown)}
      onPointerUp={onInputFieldSurface(pressSound.onPointerUp)}
      onPointerCancel={pressSound.onPointerCancel}
      onClick={onInputFieldSurface(pressSound.onClick)}
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
