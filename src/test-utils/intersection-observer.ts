import { vi } from "vitest";

type Report = (entries: Array<IntersectionObserverEntry>) => void;

/**
 * Replaces `IntersectionObserver` with a manually controlled fake.
 *
 * Call the returned function with a target and intersection state to notify its observers. Like the stub in
 * `vitest.setup.ts`, the fake does not automatically report intersections, so observed elements remain out of view
 * until reported.
 */
export function stubIntersectionObserver() {
  const observedTargets = new Map<Report, Set<Element>>();

  class FakeIntersectionObserver {
    readonly #report: Report;

    constructor(callback: IntersectionObserverCallback) {
      this.#report = (entries) => callback(entries, this as unknown as IntersectionObserver);
    }

    observe(target: Element) {
      observedTargets.set(this.#report, (observedTargets.get(this.#report) ?? new Set()).add(target));
    }

    unobserve(target: Element) {
      observedTargets.get(this.#report)?.delete(target);
    }

    disconnect() {
      observedTargets.delete(this.#report);
    }
  }

  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);

  return (target: Element, isIntersecting: boolean) => {
    for (const [report, targets] of [...observedTargets]) {
      if (targets.has(target)) {
        report([{ target, isIntersecting } as IntersectionObserverEntry]);
      }
    }
  };
}
