/**
 * Creates the listener half of a `useSyncExternalStore` store; state remains in the owning module.
 *
 * Use `client-store.ts` in client-only components.
 */
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
