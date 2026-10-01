import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { playClickSound } from "#/lib/audio/sounds.ts";
import { usePressSound } from "#/lib/audio/use-press-sound.ts";
import { cx } from "#/lib/class-names.ts";
import type { Position } from "#/lib/geometry.ts";
import { useMenuInteraction } from "#/lib/hooks/use-menu-interaction.ts";
import { isPrimaryPress } from "#/lib/press.ts";
import type { StyleWithVars } from "#/lib/style.ts";

import styles from "./popup-menu.module.css";

const OPEN_OPTIONS_KEYS = new Set(["ArrowDown", "ArrowUp"]); // Enter and Space open the options through the button's `click`.

export interface PopupMenuOption<TValue extends string> {
  value: TValue;
  label: string;
}

interface OpenState {
  button: HTMLButtonElement;
  buttonRect: DOMRect;
  isPointerHeld: boolean;
  pressOrigin: Position | null;
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
          {option.label}
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function PopupMenu<TValue extends string>({
  value,
  options,
  className,
  onChange,
  "aria-label": label,
}: {
  value: TValue;
  options: ReadonlyArray<PopupMenuOption<TValue>>;
  className?: string;
  onChange: (value: TValue) => void;
  "aria-label": string;
}) {
  const id = useId();
  const [openState, setOpenState] = useState<OpenState | null>(null);
  const pressSoundHandlers = usePressSound();
  const isPressPendingRef = useRef(false);

  const labelId = `${id}-label`;
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

  function close() {
    isPressPendingRef.current = false; // A press that opens the options may end on them instead of the button, so its clearing `click` never fires.
    setOpenState(null);
  }

  return (
    <>
      <span id={labelId} hidden>
        {label}
      </span>
      <button
        id={buttonId}
        type="button"
        className={cx(styles.button, className)}
        aria-labelledby={`${labelId} ${buttonId}`}
        aria-haspopup="listbox"
        aria-expanded={openState !== null}
        aria-controls={openState ? optionsId : undefined}
        {...pressSoundHandlers}
        onMouseDown={(event) => event.preventDefault()} // Prevent the button from reclaiming focus when the options receive it on open.
        onPointerDown={(event) => {
          pressSoundHandlers.onPointerDown(event);

          if (!isPrimaryPress(event)) {
            return;
          }

          const button = event.currentTarget;

          if (button.hasPointerCapture(event.pointerId)) {
            button.releasePointerCapture(event.pointerId); // Touch implicitly captures the pointer to its target, preventing a release outside the options from closing them.
          }

          isPressPendingRef.current = true;

          toggle(button, { isPointerHeld: true, pressOrigin: { x: event.clientX, y: event.clientY } });
        }}
        onClick={(event) => {
          pressSoundHandlers.onClick(event);

          if (isPressPendingRef.current) {
            // Ignore clicks following a button press, which is already handled by `onPointerDown`. Other clicks come from
            // Enter, Space, assistive technology, or iOS retargeting a nearby tap's compatibility click to the button.
            isPressPendingRef.current = false;
            return;
          }

          toggle(event.currentTarget, { isPointerHeld: false, pressOrigin: null });
        }}
        onKeyDown={(event) => {
          pressSoundHandlers.onKeyDown(event);

          if (OPEN_OPTIONS_KEYS.has(event.key) && openState === null) {
            event.preventDefault();
            playClickSound();
            toggle(event.currentTarget, { isPointerHeld: false, pressOrigin: null });
          }
        }}
      >
        {options[chosenOptionIndex]?.label}
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
          onClose={close}
        />
      )}
    </>
  );
}
