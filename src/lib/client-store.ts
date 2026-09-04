import { useSyncExternalStore } from "react";

import { createEmitter } from "./emitter.ts";

/**
 * A store over a value only the client can read, such as one held in local storage.
 *
 * `read` runs on the first client snapshot, so the server render and the hydration pass
 * both see `serverValue` and React re-renders with the real value once hydration finishes.
 * That keeps a mount effect out of the components that read the value.
 */
export function createClientStore<T>(serverValue: T, read: () => T) {
  let value = serverValue;
  let hasRead = false;

  const { emit, subscribe } = createEmitter();

  function getValue(): T {
    if (!hasRead) {
      hasRead = true;
      value = read();
    }

    return value;
  }

  const getServerValue = () => serverValue;

  function useValue(): T {
    return useSyncExternalStore(subscribe, getValue, getServerValue);
  }

  function setValue(next: T) {
    hasRead = true; // A read that has not run yet must not overwrite what is set here.
    value = next;
    emit();
  }

  return { useValue, getValue, setValue };
}
