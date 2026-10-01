import CrossCheckboxIndicator from "#/assets/images/checkbox-indicator-cross.svg?react";
import { usePressSound } from "#/lib/audio/use-press-sound.ts";
import { cx } from "#/lib/class-names.ts";

import styles from "./checkbox.module.css";

import type { ReactNode } from "react";

export function Checkbox({
  checked,
  disabled = false,
  className,
  onChange,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  className?: string;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  const pressSoundHandlers = usePressSound();
  return (
    <label className={cx(styles.checkbox, className)}>
      <input
        type="checkbox"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
        {...pressSoundHandlers}
      />
      <span className={styles.box} aria-hidden="true">
        {checked && <CrossCheckboxIndicator />}
      </span>
      {children}
    </label>
  );
}
