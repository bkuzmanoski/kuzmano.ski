import { useId, useLayoutEffect, useRef, useState } from "react";

import { playClickSound } from "#/lib/audio/sounds.ts";
import { usePressSound } from "#/lib/audio/use-press-sound.ts";
import { cx } from "#/lib/class-names.ts";

import styles from "./radio-group.module.css";

import type { KeyboardEvent } from "react";

const SELECTION_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

function fitsInRow(radioGroup: HTMLElement): boolean {
  const radioButtons = [...radioGroup.children];
  const columnGap = Number.parseFloat(getComputedStyle(radioGroup).columnGap) || 0;
  const rowWidth = radioButtons.reduce(
    (total, radioButton) => total + radioButton.getBoundingClientRect().width,
    columnGap * (radioButtons.length - 1),
  );

  return rowWidth <= radioGroup.getBoundingClientRect().width;
}

export interface RadioGroupOption<TValue extends string> {
  value: TValue;
  label: string;
  isSilent?: boolean;
}

export function RadioGroup<TValue extends string>({
  value,
  options,
  disabled = false,
  className,
  onChange,
  "aria-labelledby": labelledBy,
}: {
  value: TValue;
  options: ReadonlyArray<RadioGroupOption<TValue>>;
  disabled?: boolean;
  className?: string;
  onChange: (value: TValue) => void;
  "aria-labelledby": string;
}) {
  const name = useId();
  const pressSoundHandlers = usePressSound();
  const [isStacked, setIsStacked] = useState(false);
  const isSelectionKeyPendingRef = useRef(false);
  const radioGroupRef = useRef<HTMLDivElement>(null);

  // Stack an overflowing group before its initial paint.
  useLayoutEffect(() => {
    const radioGroup = radioGroupRef.current;

    if (!radioGroup) {
      return;
    }

    const measure = () => setIsStacked(!fitsInRow(radioGroup));
    const observer = new ResizeObserver(measure);

    measure();
    observer.observe(radioGroup);

    for (const radioButton of radioGroup.children) {
      observer.observe(radioButton);
    }

    return () => observer.disconnect();
  }, [options]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, option: RadioGroupOption<TValue>) {
    if (!option.isSilent) {
      pressSoundHandlers.onKeyDown(event);
    }

    isSelectionKeyPendingRef.current = SELECTION_KEYS.has(event.key);
  }

  function onSelect(option: RadioGroupOption<TValue>) {
    if (isSelectionKeyPendingRef.current) {
      isSelectionKeyPendingRef.current = false;

      if (!option.isSilent) {
        playClickSound();
      }
    }

    onChange(option.value);
  }

  return (
    <div
      ref={radioGroupRef}
      role="radiogroup"
      className={cx(styles.radioGroup, className)}
      aria-labelledby={labelledBy}
      data-stacked={isStacked || undefined}
    >
      {options.map((option) => (
        <label key={option.value} className={styles.radioButton}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            disabled={disabled}
            {...(option.isSilent ? null : pressSoundHandlers)}
            onKeyDown={(event) => onKeyDown(event, option)}
            onKeyUp={() => {
              isSelectionKeyPendingRef.current = false;
            }}
            onChange={() => onSelect(option)}
          />
          <span className={styles.circle} aria-hidden="true" />
          {option.label}
        </label>
      ))}
    </div>
  );
}
