import { useState } from "react";

import { useTimers } from "./use-timer";

const DEFAULT_FLASH_COUNT = 2;
const DEFAULT_FLASH_MS = 80;

export function useActivationFlash<T>({
  count = DEFAULT_FLASH_COUNT,
  intervalMs = DEFAULT_FLASH_MS,
}: { count?: number; intervalMs?: number } = {}) {
  const [flash, setFlash] = useState<{ target: T; isOn: boolean } | null>(null);
  const timers = useTimers();

  /* Read from the timers, not from state, so a caller can latch
   * on it within the same event that started the flash. */
  function isRunning() {
    return timers.isPending();
  }

  function start(target: T, onDone?: () => void) {
    timers.cancelAll();

    setFlash({ target, isOn: false });

    // The step above turned the highlight off; the rest alternate from there.
    const steps = count * 2 - 1;

    for (let step = 1; step <= steps; step++) {
      timers.add(() => setFlash({ target, isOn: step % 2 === 1 }), intervalMs * step);
    }

    timers.add(
      () => {
        timers.cancelAll();
        setFlash(null);
        onDone?.();
      },
      intervalMs * (steps + 1),
    );
  }

  function isHighlighted(target: T, whenIdle: boolean) {
    return flash !== null && flash.target === target ? flash.isOn : whenIdle;
  }

  return { start, isRunning, isHighlighted };
}
