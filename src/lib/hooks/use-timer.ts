import { useEffect, useRef } from "react";

/** A single resettable timeout, cancelled when the component unmounts. */
export function useTimer() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancel() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  /** Starts the timer, replacing whatever was pending. */
  function start(callback: () => void, delayMs: number) {
    cancel();
    timerRef.current = setTimeout(callback, delayMs);
  }

  useEffect(() => cancel, []);

  return { start, cancel };
}

/** A batch of timeouts started together and cancelled together, and on unmount. */
export function useTimers() {
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const isPending = () => timersRef.current.length > 0;

  function cancelAll() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  function add(callback: () => void, delayMs: number) {
    timersRef.current.push(setTimeout(callback, delayMs));
  }

  useEffect(() => cancelAll, []);

  return { add, cancelAll, isPending };
}
