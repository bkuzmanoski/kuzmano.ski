import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { fakeScrollViewport } from "#/test-utils/audio.ts";

import {
  DETENT_PIXELS,
  IDLE_DURATION_MS,
  playInputScroll,
  playPaneScroll,
  playScroll,
  playScrollStep,
  recordScrollAt,
  recordScrollIntoView,
  scrollIntoViewSilently,
  silenceScrollIntoView,
  stepScroll,
} from "./scroll.ts";
import { playScrollDetent } from "./sounds.ts";

vi.mock("./sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
);

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

function scrollTo(element: Element & { scrollTop: number }, top: number, elapsedTimeMs = 16) {
  now += elapsedTimeMs;
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

  test("plays one detent per notch of travel, not one per event", () => {
    const element = fakeScrollViewport();
    const move = DETENT_PIXELS / 4; // Four events to the notch, so one per event would play eight.

    playScroll(element);

    for (let event = 1; event <= 8; event += 1) {
      scrollTo(element, move * event);
    }

    expect(detents()).toBe(3); // The notch the gesture opens with, then one for each travelled.
  });

  test("starts a new gesture after a long pause", () => {
    const element = fakeScrollViewport();

    playScroll(element);
    scrollTo(element, 500, IDLE_DURATION_MS + 1);

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

describe("recordScrollAt", () => {
  test("records a position without playing a detent", () => {
    const element = fakeScrollViewport();

    playScroll(element);
    element.scrollTop = 500;
    recordScrollAt(element);

    expect(detents()).toBe(0);

    scrollTo(element, 500);

    expect(detents()).toBe(0);
  });
});

describe("recordScrollIntoView", () => {
  test("records the position of a scrolling ancestor", () => {
    const parent = fakeScrollViewport();
    const child = fakeScrollViewport();

    Object.defineProperty(child, "parentElement", { value: parent });

    playScroll(parent);
    parent.scrollTop = 500;
    recordScrollIntoView(child);
    scrollTo(parent, 500);

    expect(detents()).toBe(0);
  });

  test("does not create a gesture for an ancestor that has not scrolled", () => {
    const parent = fakeScrollViewport();
    const child = fakeScrollViewport();

    Object.defineProperty(child, "parentElement", { value: parent });

    recordScrollIntoView(child);
    parent.scrollTop = 500;
    playScroll(parent);

    expect(detents()).toBe(0);
  });

  test("leaves the ancestor's scroll audible", () => {
    const parent = fakeScrollViewport();
    const child = fakeScrollViewport();

    Object.defineProperty(child, "parentElement", { value: parent });

    playScroll(parent);
    parent.scrollTop = 500;
    recordScrollIntoView(child);
    scrollTo(parent, 500 + DETENT_PIXELS);

    expect(detents()).toBe(1);
  });
});

describe("silenceScrollIntoView", () => {
  // Safari animates the scroll that reveals a focused element, so it arrives afterwards as a
  // run of scroll events rather than as one move that could have been recorded beforehand.
  test("silences a scrolling ancestor for as long as the scroll it causes is still running", () => {
    const parent = fakeScrollViewport();
    const child = fakeScrollViewport();

    Object.defineProperty(child, "parentElement", { value: parent });

    playScroll(parent);
    silenceScrollIntoView(child); // The ancestor has not moved yet.

    for (let frame = 1; frame <= 6; frame += 1) {
      scrollTo(parent, DETENT_PIXELS * frame);
    }

    expect(detents()).toBe(0);
  });

  test("resumes the ancestor's scroll sounds after its scroll has settled", () => {
    const parent = fakeScrollViewport();
    const child = fakeScrollViewport();

    Object.defineProperty(child, "parentElement", { value: parent });

    playScroll(parent);
    silenceScrollIntoView(child);
    scrollTo(parent, DETENT_PIXELS * 4);

    now += IDLE_DURATION_MS * 2; // The scroll has settled.
    scrollTo(parent, DETENT_PIXELS * 5);
    scrollTo(parent, DETENT_PIXELS * 6);

    expect(detents()).toBe(1);
  });
});

describe("stepScroll", () => {
  test("scrolls by the step and plays a detent", () => {
    const element = fakeScrollViewport();

    expect(stepScroll(element, 40)).toBe(true);
    expect(element.scrollTop).toBe(40);
    expect(detents()).toBe(1);
  });

  test("scrolls instantly, so the move is complete before the result is read", () => {
    const element = fakeScrollViewport();
    const scrollBy = vi.spyOn(element, "scrollBy");

    stepScroll(element, 40);

    expect(scrollBy).toHaveBeenCalledWith({ top: 40, behavior: "instant" });
  });

  test("reports a step that cannot move the viewport and stays silent", () => {
    const element = fakeScrollViewport();

    expect(stepScroll(element, -40)).toBe(false);
    expect(element.scrollTop).toBe(0);
    expect(detents()).toBe(0);
  });

  test("ignores the scroll the step causes", () => {
    const element = fakeScrollViewport();

    playScroll(element);
    stepScroll(element, 40);
    scrollTo(element, 40);

    expect(detents()).toBe(1);
  });
});

describe("scrollIntoViewSilently", () => {
  function fakeItem(parent: Element) {
    const scrollIntoView = vi.fn();
    const item = { parentElement: parent, scrollIntoView } as unknown as Element;

    return { item, scrollIntoView };
  }

  test("scrolls instantly, so the jump cannot arrive as a stream of scroll events", () => {
    const { item, scrollIntoView } = fakeItem(fakeScrollViewport());

    scrollIntoViewSilently(item);

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "instant" });
  });

  test("keeps the caller's alignment but never its behaviour", () => {
    const { item, scrollIntoView } = fakeItem(fakeScrollViewport());

    scrollIntoViewSilently(item, { block: "start" });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
  });

  test("records the scroll it causes so the viewport does not play a detent for it", () => {
    const viewport = fakeScrollViewport();
    const { item, scrollIntoView } = fakeItem(viewport);

    playScroll(viewport); // Opens a gesture at 0.
    scrollIntoView.mockImplementation(() => {
      viewport.scrollTop = 500; // `scrollIntoView` moves the viewport before it returns.
    });

    scrollIntoViewSilently(item);
    scrollTo(viewport, 500); // The scroll event the jump left behind.

    expect(detents()).toBe(0);
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

describe("playPaneScroll", () => {
  test("plays a detent when the viewport height has not changed", () => {
    const element = fakeScrollViewport();

    playPaneScroll(element);
    now += 16;
    element.scrollTop = DETENT_PIXELS;
    playPaneScroll(element);

    expect(detents()).toBe(1);
  });

  test("records the scroll a resize causes without playing a detent", () => {
    const element = fakeScrollViewport();

    playPaneScroll(element);
    now += 16;
    element.clientHeight += 40; // The window the pane sits in was made taller.
    element.scrollTop = 40;
    playPaneScroll(element);

    expect(detents()).toBe(0);
  });

  test("plays the next scroll using the viewport height after a resize", () => {
    const element = fakeScrollViewport();

    playPaneScroll(element);
    element.clientHeight += 40;
    element.scrollTop = 40;
    playPaneScroll(element);
    now += 16;
    element.scrollTop = 40 + DETENT_PIXELS;
    playPaneScroll(element);

    expect(detents()).toBe(1);
  });
});

describe("playInputScroll", () => {
  test("plays a detent when the content height has not changed", () => {
    const element = fakeScrollViewport();

    playInputScroll(element);
    now += 16;
    element.scrollTop = DETENT_PIXELS;
    playInputScroll(element);

    expect(detents()).toBe(1);
  });

  test("records the scroll an edit causes without playing a detent", () => {
    const element = fakeScrollViewport();

    playInputScroll(element);
    now += 16;
    element.scrollHeight += 20; // A line the edit added.
    element.scrollTop = 20;
    playInputScroll(element);

    expect(detents()).toBe(0);
  });

  test("plays the next scroll using the field height after an edit", () => {
    const element = fakeScrollViewport();

    playInputScroll(element);
    element.scrollHeight += 20;
    element.scrollTop = 20;
    playInputScroll(element);
    now += 16;
    element.scrollTop = 20 + DETENT_PIXELS;
    playInputScroll(element);

    expect(detents()).toBe(1);
  });
});
