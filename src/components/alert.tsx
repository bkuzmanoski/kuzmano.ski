import { useEffect, useRef } from "react";

import { playError, playSuccess } from "#/lib/audio/sounds.ts";
import { cx } from "#/lib/class-names.ts";
import { containsPoint } from "#/lib/geometry.ts";

import styles from "./alert.module.css";
import { Button } from "./button.tsx";

import type { PointerEvent as ReactPointerEvent, Ref } from "react";

const CHAR_INFORMATION_ICON = "💁";
const CHAR_ERROR_ICON = "⯃";

export interface AlertAction {
  label: string;
  onAction: (() => void) | string;
}

function isPressOutside(event: ReactPointerEvent<HTMLDialogElement>) {
  return !containsPoint(event.currentTarget.getBoundingClientRect(), { x: event.clientX, y: event.clientY });
}

function runAction({ onAction }: AlertAction) {
  if (typeof onAction === "string") {
    location.href = onAction;
  } else {
    onAction();
  }
}

function ActionButton({ action, autoFocus, ref }: { action: AlertAction; autoFocus: boolean; ref?: Ref<never> }) {
  return typeof action.onAction === "string" ? (
    <Button ref={ref} autoFocus={autoFocus} href={action.onAction}>
      {action.label}
    </Button>
  ) : (
    <Button ref={ref} autoFocus={autoFocus} onClick={action.onAction}>
      {action.label}
    </Button>
  );
}

/**
 * A modal or page-level alert.
 *
 * Modal alerts are controlled with `open`; page-level alerts are always present so they
 * remain available in prerendered HTML. `showModal` provides the browser's modal behaviour.
 */
export function Alert(
  props: ({ modal?: true; open: boolean } | { modal: false; open?: never }) & {
    variant?: "information" | "error";
    sound?: "error" | "success" | "none";
    label?: string;
    message: string;
    primaryAction: AlertAction;
    secondaryAction?: AlertAction;
  },
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const primaryActionRef = useRef<HTMLElement>(null);

  const { variant, sound = "error", label, message, primaryAction, secondaryAction } = props;
  const modal = props.modal !== false;
  const open = props.modal === false || props.open;

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog || !modal) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      primaryActionRef.current?.focus(); // `showModal()` may focus the dialog itself.

      if (sound !== "none") {
        (sound === "success" ? playSuccess : playError)();
      }
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [modal, open, sound]);

  return (
    <dialog
      ref={dialogRef}
      open={modal ? undefined : open}
      className={styles.alert}
      aria-label={label}
      onPointerDown={(event) => {
        if (isPressOutside(event)) {
          playError();
        }
      }}
      onCancel={(event) => {
        event.preventDefault(); // Prevent the browser from closing it; the owner controls `open`.
        runAction(secondaryAction ?? primaryAction);
      }}
    >
      {open && (
        <>
          <span className={cx(styles.icon, styles[variant ?? "error"])} aria-hidden>
            {variant === "information" ? CHAR_INFORMATION_ICON : CHAR_ERROR_ICON}
          </span>
          <p className={styles.message}>{message}</p>
          <div className={styles.actions}>
            {secondaryAction && <ActionButton action={secondaryAction} autoFocus={false} />}
            <ActionButton action={primaryAction} autoFocus={!modal} ref={primaryActionRef as Ref<never>} />
          </div>
        </>
      )}
    </dialog>
  );
}
