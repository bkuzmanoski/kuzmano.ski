/* The listener half of a `useSyncExternalStore` store. State stays in the
 * owning module, since each store differs in how it reads and derives it. */
export function createEmitter() {
  const listeners = new Set<() => void>();

  function emit() {
    for (const listener of listeners) {
      listener();
    }
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { emit, subscribe };
}

/** For `useSyncExternalStore` values that never change after mount. */
export const noSubscribe = () => () => {};
