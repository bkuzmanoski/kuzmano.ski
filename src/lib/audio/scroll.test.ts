import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { fakeScrollViewport } from "#/test-utils/audio.ts";

import {
  DETENT_PX,
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

  test("plays a detent once the element has scrolled `DETENT_PX`", () => {
    const element = fakeScrollViewport();

    playScroll(element);
    scrollTo(element, DETENT_PX);

    expect(detents()).toBe(1);
  });

  test("does not play another detent until the element has scrolled another `DETENT_PX`", () => {
    const element = fakeScrollViewport();

    playScroll(element);
    scrollTo(element, 2);
    vi.mocked(playScrollDetent).mockClear();
    scrollTo(element, 3); // 3px of credit: still short of a notch.

    expect(detents()).toBe(0);
  });

  test("plays one detent per `DETENT_PX` scrolled, not one per scroll event", () => {
    const element = fakeScrollViewport();
    const move = DETENT_PX / 4; // Four events to the notch, so one per event would play eight.

    playScroll(element);

    for (let event = 1; event <= 8; event += 1) {
      scrollTo(element, move * event);
    }

    expect(detents()).toBe(3); // The notch the gesture opens with, then one for each traveled.
  });

  test("starts a new gesture after a pause longer than `IDLE_DURATION_MS`", () => {
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

  test("plays a detent at a higher speed for faster scrolling", () => {
    const slowViewport = fakeScrollViewport();
    const fastViewport = fakeScrollViewport();

    playScroll(slowViewport);
    scrollTo(slowViewport, 40, 200);
    playScroll(fastViewport);
    scrollTo(fastViewport, 40, 4);

    const [slowDetent, fastDetent] = vi.mocked(playScrollDetent).mock.calls;

    expect(fastDetent![0]).toBeGreaterThan(slowDetent![0]);
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
    scrollTo(parent, 500); // Advances the clock, so a gesture wrongly created above would play a detent.

    expect(detents()).toBe(0);
  });

  test("leaves the ancestor's scroll audible", () => {
    const parent = fakeScrollViewport();
    const child = fakeScrollViewport();

    Object.defineProperty(child, "parentElement", { value: parent });

    playScroll(parent);
    parent.scrollTop = 500;
    recordScrollIntoView(child);
    scrollTo(parent, 500 + DETENT_PX);

    expect(detents()).toBe(1);
  });
});

describe("silenceScrollIntoView", () => {
  test("silences a scrolling ancestor while its scroll events arrive within `IDLE_DURATION_MS` of each other", () => {
    const parent = fakeScrollViewport();
    const child = fakeScrollViewport();

    Object.defineProperty(child, "parentElement", { value: parent });

    playScroll(parent);
    silenceScrollIntoView(child); // The ancestor has not moved yet.

    for (let frame = 1; frame <= 6; frame += 1) {
      scrollTo(parent, DETENT_PX * frame);
    }

    // Safari animates the scroll that reveals a focused element, so it arrives afterwards as a
    // run of scroll events rather than as one move that could have been recorded beforehand.
    expect(detents()).toBe(0);
  });

  test("resumes the ancestor's scroll sounds after a pause longer than `IDLE_DURATION_MS`", () => {
    const parent = fakeScrollViewport();
    const child = fakeScrollViewport();

    Object.defineProperty(child, "parentElement", { value: parent });

    playScroll(parent);
    silenceScrollIntoView(child);
    scrollTo(parent, DETENT_PX * 4);

    now += IDLE_DURATION_MS * 2; // The scroll has settled.
    scrollTo(parent, DETENT_PX * 5);
    scrollTo(parent, DETENT_PX * 6);

    expect(detents()).toBe(1);
  });
});

describe("stepScroll", () => {
  test("scrolls by the step, plays a detent, and returns `true`", () => {
    const element = fakeScrollViewport();

    expect(stepScroll(element, 40)).toBe(true);
    expect(element.scrollTop).toBe(40);
    expect(detents()).toBe(1);
  });

  test("scrolls instantly", () => {
    // The step completes before its result is read.
    const element = fakeScrollViewport();
    const scrollBy = vi.spyOn(element, "scrollBy");

    stepScroll(element, 40);

    expect(scrollBy).toHaveBeenCalledWith({ top: 40, behavior: "instant" });
  });

  test("returns `false` and does not play a detent for a step that cannot move the viewport", () => {
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

  test("scrolls instantly", () => {
    // A smooth scroll would arrive as a stream of scroll events after the one that is silenced.
    const { item, scrollIntoView } = fakeItem(fakeScrollViewport());

    scrollIntoViewSilently(item);

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "instant" });
  });

  test("preserves the caller's alignment and still scrolls instantly", () => {
    const { item, scrollIntoView } = fakeItem(fakeScrollViewport());

    scrollIntoViewSilently(item, { block: "start" });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
  });

  test("ignores the scroll it causes", () => {
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
  test("plays a detent and ignores a later scroll event at the same position", () => {
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
    element.scrollTop = DETENT_PX;
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

  test("plays a detent for the scroll after the one a resize causes", () => {
    const element = fakeScrollViewport();

    playPaneScroll(element);
    element.clientHeight += 40;
    element.scrollTop = 40;
    playPaneScroll(element);
    now += 16;
    element.scrollTop = 40 + DETENT_PX;
    playPaneScroll(element);

    expect(detents()).toBe(1);
  });
});

describe("playInputScroll", () => {
  test("plays a detent when the content height has not changed", () => {
    const element = fakeScrollViewport();

    playInputScroll(element);
    now += 16;
    element.scrollTop = DETENT_PX;
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

  test("plays a detent for the scroll after the one an edit causes", () => {
    const element = fakeScrollViewport();

    playInputScroll(element);
    element.scrollHeight += 20;
    element.scrollTop = 20;
    playInputScroll(element);
    now += 16;
    element.scrollTop = 20 + DETENT_PX;
    playInputScroll(element);

    expect(detents()).toBe(1);
  });
});
