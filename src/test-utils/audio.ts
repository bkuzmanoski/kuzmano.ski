import { vi } from "vitest";

function stub(value: unknown): unknown {
  if (typeof value === "function") {
    return vi.fn();
  }

  return value; // A constant the module exports which a test can assert on.
}

/**
 * Mocks an audio module by stubbing every export, then applying `overrides`.
 *
 * A mock that lists only the exports it needs can silently fall behind the module it replaces.
 * A newly added export becomes `undefined`, and code that calls it can fail later from an event
 * handler without failing the test. Stubbing every export keeps the mock in sync with the
 * module, while `overrides` lets each test provide the exports it needs to assert on.
 *
 * The factory has to reach the original module through a dynamic import because `vi.mock` is
 * hoisted above the file's own imports:
 *
 * ```ts
 * vi.mock("#/lib/audio/scroll.ts", async (importOriginal) =>
 *   (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, { skipScrollAbove }),
 * );
 * ```
 */
export async function audioModuleMock<T extends object>(
  importOriginal: () => Promise<T>,
  overrides: Partial<T> = {},
): Promise<T> {
  const actual = await importOriginal();
  const stubbed = Object.entries(actual).map(([name, value]) => [name, stub(value)]);

  return { ...Object.fromEntries(stubbed), ...overrides } as T;
}

export class FakeAudioContext {
  static initialState: AudioContextState = "suspended";
  static instances: Array<FakeAudioContext> = [];
  static connections: Array<unknown> = [];

  static reset() {
    FakeAudioContext.initialState = "suspended";
    FakeAudioContext.instances = [];
    FakeAudioContext.connections = [];
  }

  state: AudioContextState = FakeAudioContext.initialState;
  currentTime = 0;
  destination = { id: "destination" };
  sampleRate: number;
  resumeCount = 0;

  // What the next `resume()` returns. Set it to a rejected promise, or to one that
  // never settles, to stand in for a gesture the browser declined to honour.
  resumeResult: Promise<void> = Promise.resolve();

  private listeners = new Set<() => void>();

  constructor({ sampleRate = 22_050 }: { sampleRate?: number } = {}) {
    this.sampleRate = sampleRate;
    FakeAudioContext.instances.push(this);
  }

  resume() {
    this.resumeCount++;
    return this.resumeResult;
  }

  createBuffer(_channels: number, length: number, rate: number) {
    const data = new Float32Array(length);
    return { length, sampleRate: rate, getChannelData: () => data };
  }

  createGain() {
    return {
      gain: { value: 0 },
      connect: (target: unknown) => FakeAudioContext.connections.push(target),
    };
  }

  addEventListener(_type: string, listener: () => void) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: () => void) {
    this.listeners.delete(listener);
  }

  // Simulates reaching "running" and notifies listeners waiting for the transition.
  reachRunning() {
    this.state = "running";
    this.listeners.forEach((listener) => listener());
  }
}

/** A context for suites that only render buffers, where the state machine does not matter. */
export const fakeAudioContext = (sampleRate = 22_050): AudioContext =>
  new FakeAudioContext({ sampleRate }) as unknown as AudioContext;

/** A scrollable element stand-in; `scrollTop` is set directly as it is by the browser. */
export function fakeScrollViewport({ scrollHeight = 1000, clientHeight = 100 } = {}) {
  const element = {
    scrollTop: 0,
    scrollHeight,
    clientHeight,
    parentElement: null as Element | null,
    scrollBy({ top = 0 }: ScrollToOptions = {}) {
      element.scrollTop = Math.min(Math.max(element.scrollTop + top, 0), scrollHeight - clientHeight);
    },
  };

  return element as unknown as Element & typeof element;
}
