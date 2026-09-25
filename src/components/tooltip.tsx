import { cloneElement, isValidElement, useEffect, useEffectEvent, useId, useRef, useState } from "react";

import { cx } from "#/lib/class-names.ts";
import { useTimer } from "#/lib/hooks/use-timer.ts";
import type { StyleWithVars } from "#/lib/style.ts";
import {
  hideAfterDelay,
  isGroupInGracePeriod,
  registerShownTooltip,
  resetGroupGracePeriod,
  runPendingHideAction,
  startGroupGracePeriod,
  unregisterShownTooltip,
} from "#/lib/tooltip.ts";

import styles from "./tooltip.module.css";

import type { ReactNode } from "react";

export const HOVER_DELAY_MS = 400;

interface TooltipChildProps {
  "aria-describedby"?: string;
  "aria-label"?: string;
}

// A control whose `aria-label` attribute is the tooltip's label already has the name the tooltip
// shows, so describing it by the tooltip as well would read the same words twice. A control named
// otherwise is described, since its name need not include the label.
const isNamedByLabel = (props: TooltipChildProps, label: string) => props["aria-label"] === label;

export function Tooltip({
  label,
  margin = 4,
  persistOnPress = false,
  showsState = false,
  suppressed = false,
  childTextIncludesLabel = false, // Set when the child's text already contains the label, such as in visually hidden text.
  onDidHide, // Run when a visible tooltip is hidden. Use it to clear transient state once the tooltip has finished displaying it.
  className,
  children,
}: {
  label: string;
  margin?: number;
  persistOnPress?: boolean;
  showsState?: boolean;
  suppressed?: boolean;
  childTextIncludesLabel?: boolean;
  onDidHide?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [wasShowingState, setWasShowingState] = useState(showsState);
  const [wasSuppressed, setWasSuppressed] = useState(suppressed);
  const [isPointerHovering, setIsPointerHovering] = useState(false);
  const timer = useTimer();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const lastPointerTypeRef = useRef<string | null>(null);
  const reportHidden = useEffectEvent(() => onDidHide?.());

  if (suppressed !== wasSuppressed) {
    setWasSuppressed(suppressed);
    setIsOpen(false);
  }

  if (showsState !== wasShowingState) {
    setWasShowingState(showsState);

    // The control takes the tooltip over from the pointer while it displays its state. When it
    // stops, the tooltip goes with it unless a pointer is still on the control to keep it visible.
    setIsOpen(showsState || isPointerHovering);
  }

  const isVisible = isOpen && !suppressed;

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    registerShownTooltip(id, () => setIsOpen(false));
    resetGroupGracePeriod(id, wrapperRef.current);

    return () => {
      unregisterShownTooltip(id);
      startGroupGracePeriod(id);
      reportHidden();
    };
  }, [isVisible, id]);

  // The Escape key hides a visible tooltip while the pointer and the focus stay on the control. The
  // event is not stopped, so the press that hides a tooltip in a menu also closes the menu.
  useEffect(() => {
    if (!isVisible) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isVisible]);

  function show(delay: number) {
    timer.cancel();

    if (suppressed) {
      return;
    }

    timer.start(() => {
      runPendingHideAction();
      setIsOpen(true);
    }, delay);
  }

  function hide(immediately: boolean = false) {
    timer.cancel();

    if (isVisible && !immediately) {
      hideAfterDelay(() => setIsOpen(false));
      return;
    }

    setIsOpen(false);
  }

  const wrapperStyle: StyleWithVars = { "--tooltip-margin": `${margin}px` };

  return (
    <span
      ref={wrapperRef}
      className={cx(styles.wrapper, className)}
      style={wrapperStyle}
      onFocusCapture={(event) => {
        if (event.target.matches(":focus-visible")) {
          show(0);
        }
      }}
      onBlurCapture={() => {
        hide(true);
      }}
      onPointerDownCapture={(event) => {
        lastPointerTypeRef.current = event.pointerType;

        // `persistOnPress` keeps the tooltip through a press on the control, not on the tooltip.
        if (!persistOnPress || tipRef.current?.contains(event.target as Node)) {
          hide(true);
        }
      }}
      onPointerEnter={(event) => {
        // iOS raises a synthesized mouse event after a tap. No pointer has arrived to hover,
        // so acting on it would surface a tooltip after the tap that dismissed it.
        const isSynthesizedAfterTouch = event.pointerType !== "touch" && lastPointerTypeRef.current === "touch";

        lastPointerTypeRef.current = event.pointerType;

        if (isSynthesizedAfterTouch) {
          return;
        }

        const isHovering = event.pointerType !== "touch";

        setIsPointerHovering(isHovering);

        // The grace period is a hover affordance. A touch pointer has not traveled from a neighboring
        // control, and showing on contact would pre-empt the press it is about to make.
        const skipsHoverDelay = isHovering && isGroupInGracePeriod(wrapperRef.current);

        show(skipsHoverDelay ? 0 : HOVER_DELAY_MS);
      }}
      onPointerLeave={(event) => {
        const wasHovering = isPointerHovering;

        setIsPointerHovering(false);
        timer.cancel();
        lastPointerTypeRef.current = event.pointerType;

        // Only a pointer that was hovering can leave one. A touch lifting, and the synthesized
        // mouse event iOS raises around a tap, are the tap finishing rather than a pointer moving
        // away, and must not hide a tooltip the press has just shown.
        if (!wasHovering) {
          return;
        }

        hide();
      }}
      onPointerCancel={(event) => {
        lastPointerTypeRef.current = event.pointerType;
        setIsPointerHovering(false);
        hide(true);
      }}
    >
      {isValidElement<TooltipChildProps>(children) && !childTextIncludesLabel && !isNamedByLabel(children.props, label)
        ? cloneElement(children, { "aria-describedby": isVisible ? id : undefined })
        : children}
      {isVisible && (
        <span ref={tipRef} id={id} className={styles.tip} role="tooltip">
          {label}
        </span>
      )}
    </span>
  );
}
