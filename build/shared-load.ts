/** A shared asynchronous load retained until it is cleared. */
export interface SharedLoad<T> {
  /** Gets the existing load, or starts one if none exists. */
  get: () => Promise<T>;
  /** Removes the current load so the next `get` creates a new one. */
  clear: () => void;
  /** Gets the current load without creating one. */
  current: () => Promise<T> | null;
}

/**
 * Reuses a single in-flight or completed `load` call for all callers. This pattern is duplicated by `workerEnv` in
 * `/src/server/env.ts` because `src` cannot import `build`. Rejected loads clear themselves so later callers retry,
 * without clearing a newer load started after `clear` was called.
 */
export function sharedLoad<T>(load: () => Promise<T>): SharedLoad<T> {
  let currentLoad: Promise<T> | null = null;

  return {
    get() {
      if (currentLoad) {
        return currentLoad;
      }

      const attempt: Promise<T> = load().catch((cause: unknown) => {
        if (currentLoad === attempt) {
          currentLoad = null;
        }

        throw cause;
      });

      return (currentLoad = attempt);
    },
    clear() {
      currentLoad = null;
    },
    current: () => currentLoad,
  };
}
