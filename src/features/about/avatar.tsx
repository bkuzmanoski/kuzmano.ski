import { useEffect, useId, useRef, useState } from "react";

import AvatarGraphic from "#/assets/images/avatar-graphic.svg?react";
import { AUTHOR_NAME } from "#/config/site.ts";
import { cx } from "#/lib/class-names.ts";
import { mergeRefs } from "#/lib/merge-refs.ts";

import styles from "./avatar.module.css";

import type { Ref } from "react";

type GazeDirection = "up-left" | "up-right" | "down-left" | "down-right";

const INITIAL_GAZE_DIRECTION: GazeDirection = "up-right";

function gazeDirectionToward({ clientX, clientY }: PointerEvent, graphicRect: DOMRect): GazeDirection {
  const isAbove = clientY < graphicRect.top + graphicRect.height / 2;
  const isLeft = clientX < graphicRect.left + graphicRect.width / 2;

  if (isAbove) {
    return isLeft ? "up-left" : "up-right";
  }

  return isLeft ? "down-left" : "down-right";
}

export function Avatar({
  speech,
  className,
  graphicRef,
}: {
  speech?: string;
  className?: string;
  graphicRef?: Ref<SVGSVGElement>;
}) {
  const speechId = useId();
  const [isSpeechBubbleShown, setIsSpeechBubbleShown] = useState(false);
  const [gazeDirection, setGazeDirection] = useState<GazeDirection>(INITIAL_GAZE_DIRECTION);
  const graphicElementRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const lookTowardPointer = (event: PointerEvent) => {
      if (graphicElementRef.current) {
        setGazeDirection(gazeDirectionToward(event, graphicElementRef.current.getBoundingClientRect()));
      }
    };

    document.addEventListener("pointermove", lookTowardPointer, { passive: true });
    document.addEventListener("pointerdown", lookTowardPointer, { passive: true }); // Also listen for `pointerdown` as touch input does not emit `pointermove` until the finger moves.

    return () => {
      document.removeEventListener("pointermove", lookTowardPointer);
      document.removeEventListener("pointerdown", lookTowardPointer);
    };
  }, []);

  useEffect(() => {
    if (!isSpeechBubbleShown) {
      return;
    }

    const hideSpeechBubbleOnPressOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node && graphicElementRef.current?.contains(event.target))) {
        setIsSpeechBubbleShown(false);
      }
    };

    document.addEventListener("pointerdown", hideSpeechBubbleOnPressOutside, { passive: true });

    return () => document.removeEventListener("pointerdown", hideSpeechBubbleOnPressOutside);
  }, [isSpeechBubbleShown]);

  return (
    <div className={cx(styles.avatar, className)}>
      <AvatarGraphic
        ref={mergeRefs(graphicElementRef, graphicRef)}
        role="img"
        className={styles.graphic}
        data-gaze-direction={gazeDirection}
        aria-hidden={undefined} // Overrides the `aria-hidden` added by SVGR.
        aria-label={`Pixel-art portrait of ${AUTHOR_NAME}`}
        aria-describedby={speech ? speechId : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") {
            setIsSpeechBubbleShown(true);
          }
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch") {
            setIsSpeechBubbleShown(false);
          }
        }}
        onPointerDown={() => setIsSpeechBubbleShown(true)}
      />
      {speech && (
        <div className={styles.speechBubble} data-shown={isSpeechBubbleShown || undefined} aria-hidden="true">
          <div id={speechId} className={styles.speech}>
            {speech}
          </div>
        </div>
      )}
    </div>
  );
}
