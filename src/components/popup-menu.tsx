import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { playClickSound } from "#/lib/audio/sounds.ts";
import { cx } from "#/lib/class-names.ts";
import type { Position } from "#/lib/geometry.ts";
import { useMenuButtonPress } from "#/lib/hooks/use-menu-button-press.ts";
import { useMenuInteraction } from "#/lib/hooks/use-menu-interaction.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import type { StyleWithVars } from "#/lib/style.ts";

import styles from "./popup-menu.module.css";

import type { KeyboardEvent } from "react";

/** Enter and Space open the options through the button's `click`. */
const OPEN_OPTIONS_KEYS = new Set(["ArrowDown", "ArrowUp"]);

export interface PopupMenuOption<TValue extends string> {
  value: TValue;
  label: string;
  swatchColor?: string;
}

interface OpenState {
  button: HTMLButtonElement;
  buttonRect: DOMRect;
  isPointerHeld: boolean;
  pressOrigin: Position | null;
}

function PopupMenuOptionLabel({ option }: { option: PopupMenuOption<string> }) {
  if (option.swatchColor === undefined) {
    return option.label;
  }

  const swatchStyle: StyleWithVars = { "--popup-menu-swatch-color": option.swatchColor };

  return (
    <>
      <span className={styles.swatch} style={swatchStyle} aria-hidden="true" />
      {option.label}
    </>
  );
}

function PopupMenuOptions<TValue extends string>({
  id,
  labelId,
  options,
  chosenOptionIndex,
  openState,
  onChoose,
  onClose,
}: {
  id: string;
  labelId: string;
  options: ReadonlyArray<PopupMenuOption<TValue>>;
  chosenOptionIndex: number;
  openState: OpenState;
  onChoose: (option: PopupMenuOption<TValue>) => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  const { focusedItemIndex, isHighlighted, onClick, onKeyDown } = useMenuInteraction({
    items: options.map((option) => ({ label: option.label, isEnabled: true })),
    anchor: openState.button,
    listRef,
    isPointerHeld: openState.isPointerHeld,
    pressOrigin: openState.pressOrigin,
    initialFocusedItemIndex: chosenOptionIndex,
    onActivate: (index) => {
      const option = options[index];

      if (option) {
        onChoose(option);
      }
    },
    onClose,
  });

  const onLayoutChange = useEffectEvent(onClose); // Close when layout changes because the options are positioned from the button's opening bounds.

  useEffect(() => {
    const controller = new AbortController();

    window.addEventListener("resize", onLayoutChange, { signal: controller.signal });
    document.addEventListener("scroll", onLayoutChange, { signal: controller.signal, capture: true });

    return () => controller.abort();
  }, []);

  const { buttonRect } = openState;
  const style: StyleWithVars = {
    "--popup-menu-button-top": `${buttonRect.top}px`,
    "--popup-menu-button-left": `${buttonRect.left}px`,
    "--popup-menu-button-width": `${buttonRect.width}px`,
    "--popup-menu-button-height": `${buttonRect.height}px`,
    "--popup-menu-chosen-option-index": chosenOptionIndex,
    "--popup-menu-option-count": options.length,
  };

  return createPortal(
    <div
      ref={listRef}
      id={id}
      role="listbox"
      tabIndex={-1}
      className={styles.options}
      style={style}
      aria-labelledby={labelId}
      aria-activedescendant={focusedItemIndex >= 0 ? `${id}-${focusedItemIndex}` : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {options.map((option, index) => (
        <div
          key={option.value}
          id={`${id}-${index}`}
          role="option"
          aria-selected={index === chosenOptionIndex}
          className={cx(styles.option, isHighlighted(index) && styles.active)}
          data-index={index}
        >
          <PopupMenuOptionLabel option={option} />
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function PopupMenu<TValue extends string>({
  value,
  options,
  disabled = false,
  className,
  onChange,
  "aria-label": label,
  "aria-labelledby": labelledBy,
}: {
  value: TValue;
  options: ReadonlyArray<PopupMenuOption<TValue>>;
  disabled?: boolean;
  className?: string;
  onChange: (value: TValue) => void;
} & (
  { "aria-label": string; "aria-labelledby"?: undefined } | { "aria-label"?: undefined; "aria-labelledby": string }
)) {
  const id = useId();
  const [openState, setOpenState] = useState<OpenState | null>(null);

  const labelId = labelledBy ?? `${id}-label`;
  const buttonId = `${id}-button`;
  const optionsId = `${id}-options`;
  const chosenOptionIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const toggle = (button: HTMLButtonElement, openingPress: Omit<OpenState, "button" | "buttonRect">) =>
    setOpenState((current) =>
      current ? null : { button, buttonRect: button.getBoundingClientRect(), ...openingPress },
    );

  const menuButtonPressHandlers = useMenuButtonPress({
    onPress: (event) =>
      toggle(event.currentTarget, { isPointerHeld: true, pressOrigin: { x: event.clientX, y: event.clientY } }),
    onActivate: (event) => toggle(event.currentTarget, { isPointerHeld: false, pressOrigin: null }),
  });

  return (
    <>
      {label !== undefined && (
        <span id={labelId} hidden>
          {label}
        </span>
      )}
      <button
        id={buttonId}
        type="button"
        className={cx(styles.button, className)}
        aria-labelledby={`${labelId} ${buttonId}`}
        aria-haspopup="listbox"
        aria-expanded={openState !== null}
        aria-controls={openState ? optionsId : undefined}
        disabled={disabled}
        {...mergeHandlers(menuButtonPressHandlers, {
          onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
            if (OPEN_OPTIONS_KEYS.has(event.key) && openState === null) {
              event.preventDefault();
              playClickSound();
              toggle(event.currentTarget, { isPointerHeld: false, pressOrigin: null });
            }
          },
        })}
      >
        <span className={styles.label}>
          {options.map((option, index) =>
            index === chosenOptionIndex ? (
              <span key={option.value}>
                <PopupMenuOptionLabel option={option} />
              </span>
            ) : (
              <span key={option.value} className={styles.widthReservingLabel} aria-hidden="true">
                <PopupMenuOptionLabel option={option} />
              </span>
            ),
          )}
        </span>
      </button>
      {openState && (
        <PopupMenuOptions
          id={optionsId}
          labelId={labelId}
          options={options}
          chosenOptionIndex={chosenOptionIndex}
          openState={openState}
          onChoose={(option) => {
            if (option.value !== value) {
              onChange(option.value);
            }
          }}
          onClose={() => setOpenState(null)}
        />
      )}
    </>
  );
}
