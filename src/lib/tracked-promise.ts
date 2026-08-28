/** The state React reads from a promise passed to `use()`. */
export type TrackedPromise<T> = Promise<T> & {
  status?: "pending" | "fulfilled" | "rejected";
  value?: T;
  reason?: unknown;
};

/**
 * Records a promise's outcome on the promise itself so `use()` can read a settled value
 * synchronously without suspending.
 *
 * A promise that has already resolved does not expose its value synchronously through the standard
 * Promise API. React therefore needs the outcome recorded on the promise to know that it is
 * settled when `use()` reads it. This matters during hydration because a suspension can cause
 * React to replace the server-rendered content with a Suspense fallback.
 *
 * The promise is mutated rather than wrapped, so the caller must pass this same promise to `use()`.
 */
export function trackPromise<T>(promise: Promise<T>): TrackedPromise<T> {
  const tracked: TrackedPromise<T> = promise;

  tracked.status = "pending";

  void promise.then(
    (value) => {
      tracked.status = "fulfilled";
      tracked.value = value;
    },
    (reason: unknown) => {
      tracked.status = "rejected";
      tracked.reason = reason;
    },
  );

  return tracked;
}
