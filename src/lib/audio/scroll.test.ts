import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { fakeScrollViewport } from "#/test-utils/audio";

import {
  DETENT_PIXELS,
  IDLE_MS,
  playFieldScroll,
  playScroll,
  playScrollStep,
  skipScrollAbove,
  skipScrollAt,
} from "./scroll";
import { playScrollDetent } from "./sounds";

vi.mock("./sounds", () => ({ playScrollDetent: vi.fn() }));

let now = 0;

beforeEach(() => {
  now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.mocked(playScrollDetent).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const detents = () => vi.mocked(playScrollDetent).mock.calls.length;

// Scroll to `top` after `elapsedMs`.
function scrollTo(element: Element & { scrollTop: number }, top: number, elapsedMs = 16) {
  now += elapsedMs;
  element.scrollTop = top;
  playScroll(element);
}

describe("playScroll", () => {
  test("opens a gesture without playing a detent", () => {
    const element = fakeScrollViewport();

    playScroll(element);

    expect(detents()).toBe(0);
  });

  test("plays a detent after a full notch of travel", () => {
    const element = fakeScrollViewport();

    playScroll(element);
    scrollTo(element, DETENT_PIXELS);

    expect(detents()).toBe(1);
  });

  test("stays silent until another full notch has been travelled", () => {
    const element = fakeScrollViewport();

    playScroll(element);
    scrollTo(element, 2);
    vi.mocked(playScrollDetent).mockClear();
    scrollTo(element, 3); // 3px of credit: still short of a notch.

    expect(detents()).toBe(0);
  });

  test("sounds one detent per notch of travel, not one per event", () => {
    const element = fakeScrollViewport();

    playScroll(element);

    for (let top = 2; top <= 24; top += 2) {
      scrollTo(element, top);
    }

    expect(detents()).toBe(3);
  });

  test("starts a new gesture after a long pause", () => {
    const element = fakeScrollViewport();

    playScroll(element);
    scrollTo(element, 500, IDLE_MS + 1);

    expect(detents()).toBe(0);
  });

  test("ignores overscroll beyond the content", () => {
    const element = fakeScrollViewport({ scrollHeight: 1000, clientHeight: 100 });

    element.scrollTop = 900; // The maximum.
    playScroll(element);
    scrollTo(element, 1200); // Rubber-banding beyond it.

    expect(detents()).toBe(0);
  });

  test("reports faster travel at a higher speed", () => {
    const slow = fakeScrollViewport();
    const fast = fakeScrollViewport();

    playScroll(slow);
    scrollTo(slow, 40, 200);
    playScroll(fast);
    scrollTo(fast, 40, 4);

    const [slow_, fast_] = vi.mocked(playScrollDetent).mock.calls;

    expect(fast_![0]).toBeGreaterThan(slow_![0]);
  });
});

describe("skipScrollAt", () => {
  test("records a position without playing a detent", () => {
    const element = fakeScrollViewport();

    playScroll(element);
    element.scrollTop = 500;
    skipScrollAt(element);

    expect(detents()).toBe(0);

    scrollTo(element, 500);

    expect(detents()).toBe(0);
  });
});

describe("skipScrollAbove", () => {
  test("records the position of a scrolling ancestor", () => {
    const parent = fakeScrollViewport();
    const child = fakeScrollViewport();

    Object.defineProperty(child, "parentElement", { value: parent });

    playScroll(parent);
    parent.scrollTop = 500;
    skipScrollAbove(child);
    scrollTo(parent, 500);

    expect(detents()).toBe(0);
  });

  test("does not create a gesture for an ancestor that has not scrolled", () => {
    const parent = fakeScrollViewport();
    const child = fakeScrollViewport();

    Object.defineProperty(child, "parentElement", { value: parent });
    skipScrollAbove(child);
    parent.scrollTop = 500;
    playScroll(parent);

    expect(detents()).toBe(0);
  });
});

describe("playFieldScroll", () => {
  test("plays a detent when the content height has not changed", () => {
    const element = fakeScrollViewport();

    playFieldScroll(element);
    now += 16;
    element.scrollTop = DETENT_PIXELS;
    playFieldScroll(element);

    expect(detents()).toBe(1);
  });

  test("records the scroll an edit causes without playing a detent", () => {
    const element = fakeScrollViewport();

    playFieldScroll(element);
    now += 16;
    element.scrollHeight += 20; // A line the edit added.
    element.scrollTop = 20;
    playFieldScroll(element);

    expect(detents()).toBe(0);
  });

  test("plays the next scroll using the field height after an edit", () => {
    const element = fakeScrollViewport();

    playFieldScroll(element);
    element.scrollHeight += 20;
    element.scrollTop = 20;
    playFieldScroll(element);
    now += 16;
    element.scrollTop = 20 + DETENT_PIXELS;
    playFieldScroll(element);

    expect(detents()).toBe(1);
  });
});

describe("playScrollStep", () => {
  test("plays a detent and ignores the scroll it causes", () => {
    const element = fakeScrollViewport();

    playScroll(element);
    element.scrollTop = 40;
    playScrollStep(element);

    expect(detents()).toBe(1);

    scrollTo(element, 40);

    expect(detents()).toBe(1);
  });

  test("uses the same speed for every step", () => {
    const element = fakeScrollViewport();

    playScrollStep(element);
    now += 200;
    playScrollStep(element);

    const [first, second] = vi.mocked(playScrollDetent).mock.calls;

    expect(first![0]).toBe(second![0]);
  });
});
