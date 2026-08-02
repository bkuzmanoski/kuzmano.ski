import { useEffect, useRef, useState } from "react";

const DEFAULT_FLASH_COUNT = 2;
const DEFAULT_FLASH_MS = 80;

export function useActivationFlash<T>({
  count = DEFAULT_FLASH_COUNT,
  intervalMs = DEFAULT_FLASH_MS,
}: { count?: number; intervalMs?: number } = {}) {
  const [flash, setFlash] = useState<{ target: T; isOn: boolean } | null>(null);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  /* Read from a ref, not from state, so a caller can latch
   * on it within the same event that started the flash. */
  function isRunning() {
    return timersRef.current.length > 0;
  }

  function start(target: T, onDone?: () => void) {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    setFlash({ target, isOn: false });

    // The step above turned the highlight off; the rest alternate from there.
    const steps = count * 2 - 1;

    for (let step = 1; step <= steps; step++) {
      timersRef.current.push(setTimeout(() => setFlash({ target, isOn: step % 2 === 1 }), intervalMs * step));
    }

    timersRef.current.push(
      setTimeout(
        () => {
          timersRef.current = [];
          setFlash(null);
          onDone?.();
        },
        intervalMs * (steps + 1),
      ),
    );
  }

  function isHighlighted(target: T, whenIdle: boolean) {
    return flash !== null && flash.target === target ? flash.isOn : whenIdle;
  }

  return { start, isRunning, isHighlighted };
}
