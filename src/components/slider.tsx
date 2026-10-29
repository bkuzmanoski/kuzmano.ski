import SliderThumb from "#/assets/images/slider-thumb.svg?react";
import { playSliderStepSound } from "#/lib/audio/sounds.ts";
import { usePressSound } from "#/lib/audio/use-press-sound.ts";
import { cx } from "#/lib/class-names.ts";
import { stepCountOf } from "#/lib/stepped-range.ts";
import type { StyleWithVars } from "#/lib/style.ts";

import styles from "./slider.module.css";

export function Slider({
  id,
  value,
  min,
  max,
  step,
  disabled = false,
  className,
  valueTextOf,
  onChange,
  "aria-labelledby": labelledBy,
}: {
  id?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  className?: string;
  valueTextOf?: (value: number) => string; // Returns `aria-valuetext` when the numeric value alone is not descriptive.
  onChange: (value: number) => void;
  "aria-labelledby"?: string;
}) {
  const pressSoundHandlers = usePressSound();

  const stepCount = stepCountOf({ min, max, step });
  const style: StyleWithVars = {
    "--slider-step-count": stepCount,
    "--slider-value-fraction": (value - min) / (max - min),
  };

  return (
    <div className={cx(styles.slider, className)} style={style}>
      <input
        id={id}
        type="range"
        className={styles.input}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-labelledby={labelledBy}
        aria-valuetext={valueTextOf?.(value)}
        onChange={(event) => {
          playSliderStepSound();
          onChange(Number(event.currentTarget.value));
        }}
        {...pressSoundHandlers}
      />
      <span className={styles.track} aria-hidden="true" />
      <span className={styles.ticks} aria-hidden="true">
        {Array.from({ length: stepCount + 1 }, (_, index) => (
          <span key={index} className={styles.tick} />
        ))}
      </span>
      <SliderThumb className={styles.thumb} />
    </div>
  );
}
