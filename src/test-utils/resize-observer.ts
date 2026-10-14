import { vi } from "vitest";

/**
 * Replaces `ResizeObserver` with a controllable fake.
 *
 * The returned function invokes callbacks with no entries for observers watching `target`. When no
 * target is provided, it invokes callbacks for all observers that are watching at least one element.
 */
export function stubResizeObserver() {
  const observedTargets = new Map<() => void, Set<Element>>();

  class FakeResizeObserver {
    readonly #report: () => void;

    constructor(callback: ResizeObserverCallback) {
      this.#report = () => callback([], this);
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

  vi.stubGlobal("ResizeObserver", FakeResizeObserver);

  return (target?: Element) => {
    for (const [report, targets] of [...observedTargets]) {
      if (target ? targets.has(target) : targets.size > 0) {
        report();
      }
    }
  };
}
