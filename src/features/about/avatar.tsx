import { useEffect, useRef, useState } from "react";

import LookingDownLeftAvatar from "#/assets/images/avatar-looking-down-left.svg?react";
import LookingDownRightAvatar from "#/assets/images/avatar-looking-down-right.svg?react";
import LookingUpLeftAvatar from "#/assets/images/avatar-looking-up-left.svg?react";
import LookingUpRightAvatar from "#/assets/images/avatar-looking-up-right.svg?react";

import styles from "./avatar.module.css";

type GazeDirection = "up-left" | "up-right" | "down-left" | "down-right";

const SPRITES_BY_GAZE_DIRECTION = {
  "up-left": LookingUpLeftAvatar,
  "up-right": LookingUpRightAvatar,
  "down-left": LookingDownLeftAvatar,
  "down-right": LookingDownRightAvatar,
} satisfies Record<GazeDirection, unknown>;
const INITIAL_GAZE_DIRECTION: GazeDirection = "down-right";

function gazeDirectionToward({ clientX, clientY }: PointerEvent, avatarRect: DOMRect): GazeDirection {
  const isAbove = clientY < avatarRect.top + avatarRect.height / 2;
  const isLeft = clientX < avatarRect.left + avatarRect.width / 2;

  if (isAbove) {
    return isLeft ? "up-left" : "up-right";
  }

  return isLeft ? "down-left" : "down-right";
}

export function Avatar({ alt }: { alt: string }) {
  const avatarRef = useRef<HTMLSpanElement>(null);
  const [gazeDirection, setGazeDirection] = useState<GazeDirection>(INITIAL_GAZE_DIRECTION);

  useEffect(() => {
    const lookTowardPointer = (event: PointerEvent) => {
      if (avatarRef.current) {
        setGazeDirection(gazeDirectionToward(event, avatarRef.current.getBoundingClientRect()));
      }
    };

    document.addEventListener("pointermove", lookTowardPointer, { passive: true });
    document.addEventListener("pointerdown", lookTowardPointer, { passive: true }); // Also listen for `pointerdown` as touch input does not emit `pointermove` until the finger moves.

    return () => {
      document.removeEventListener("pointermove", lookTowardPointer);
      document.removeEventListener("pointerdown", lookTowardPointer);
    };
  }, []);

  const Sprite = SPRITES_BY_GAZE_DIRECTION[gazeDirection];

  return (
    <span ref={avatarRef} role="img" aria-label={alt} className={styles.avatar}>
      <Sprite className={styles.sprite} />
    </span>
  );
}
