import { useEffect, useState } from "react";

import type { RefObject } from "react";

export function useIsRevealedAfterStartup(
  windowRef: RefObject<HTMLElement | null>,
  isStartupSequenceComplete: boolean,
): boolean {
  const [isAwaitingStartupReveal, setIsAwaitingStartupReveal] = useState(false);

  if (!isStartupSequenceComplete && !isAwaitingStartupReveal) {
    setIsAwaitingStartupReveal(true);
  }

  useEffect(() => {
    if (!isStartupSequenceComplete || !isAwaitingStartupReveal) {
      return;
    }

    const revealTransition = windowRef.current
      ?.getAnimations()
      .find((animation) => "transitionProperty" in animation && animation.transitionProperty === "opacity");
    let isCurrent = true;

    void (revealTransition?.finished ?? Promise.resolve())
      .catch(() => undefined) // A canceled transition also ends the wait.
      .then(() => {
        if (isCurrent) {
          setIsAwaitingStartupReveal(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [windowRef, isStartupSequenceComplete, isAwaitingStartupReveal]);

  return isStartupSequenceComplete && !isAwaitingStartupReveal;
}
