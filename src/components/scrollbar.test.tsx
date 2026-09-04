import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { DETENT_PIXELS, playPaneScroll } from "#/lib/audio/scroll.ts";
import { DRAG_THRESHOLD_PX } from "#/lib/hooks/use-pointer-drag.ts";
import { useScrollMetrics } from "#/lib/hooks/use-scroll-metrics.ts";
import { clamp } from "#/lib/math.ts";

import { ARROW_STEP_PX, ARROW_STEP_REPEAT_DELAY_MS, ARROW_STEP_REPEAT_INTERVAL_MS, Scrollbar } from "./scrollbar.tsx";

const playClick = vi.hoisted(() => vi.fn());
const playScrollDetent = vi.hoisted(() => vi.fn());

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, { playClick, playScrollDetent }),
);

const VIEWPORT_ID = "viewport";
const SCROLL_HEIGHT = 1_000;
const CLIENT_HEIGHT = 100;
const MAX_SCROLL_TOP = SCROLL_HEIGHT - CLIENT_HEIGHT;
const TRACK_TOP = 50;
const TRACK_HEIGHT = 200;
const THUMB_HEIGHT = 20;
const THUMB_TRAVEL = TRACK_HEIGHT - THUMB_HEIGHT;
const FRAME_MS = 16; // A drag reports its move on the frame that follows the pointer.

beforeEach(() => {
  vi.useFakeTimers();
  playClick.mockClear();
  playScrollDetent.mockClear();
});

afterEach(() => vi.useRealTimers());

// The wiring `ScrollPane` provides, repeated here because a component may not import a feature.
function Harness() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const { metrics, measure } = useScrollMetrics(viewportRef);

  return (
    <>
      <div
        ref={viewportRef}
        id={VIEWPORT_ID}
        onScroll={(event) => {
          measure();
          playPaneScroll(event.currentTarget);
        }}
      >
        <p>Content</p>
      </div>
      <Scrollbar viewportRef={viewportRef} viewportId={VIEWPORT_ID} metrics={metrics} />
    </>
  );
}

function renderScrollbar() {
  render(<Harness />);

  const viewport = document.getElementById(VIEWPORT_ID)!;
  const track = screen.getByRole("scrollbar");

  Object.defineProperty(viewport, "scrollHeight", { value: SCROLL_HEIGHT, configurable: true });
  Object.defineProperty(viewport, "clientHeight", { value: CLIENT_HEIGHT, configurable: true });

  viewport.scrollBy = ((options: ScrollToOptions = {}) => {
    viewport.scrollTop = clamp(viewport.scrollTop + (options.top ?? 0), 0, MAX_SCROLL_TOP);
  }) as typeof viewport.scrollBy;

  fireEvent.scroll(viewport); // Report the metrics, so the scrollbar sees the overflow.

  const thumb = track.firstElementChild as HTMLElement; // The thumb only renders once the reported metrics show the overflow; query after the scroll.

  Object.defineProperty(track, "clientHeight", { value: TRACK_HEIGHT, configurable: true });
  Object.defineProperty(thumb, "clientHeight", { value: THUMB_HEIGHT, configurable: true });

  track.getBoundingClientRect = () => new DOMRect(0, TRACK_TOP, 15, TRACK_HEIGHT);

  return { viewport, track, thumb, scrollDownButton: screen.getByRole("button", { name: "Scroll down" }) };
}

const thumbCentreAt = (position: number) => TRACK_TOP + THUMB_HEIGHT / 2 + position * THUMB_TRAVEL;

function pressTrackAt(track: HTMLElement, position: number) {
  fireEvent.pointerDown(track, { button: 0, clientY: thumbCentreAt(position) });
}

function dragTrackTo(track: HTMLElement, position: number) {
  fireEvent.pointerMove(track, { buttons: 1, clientY: thumbCentreAt(position) });
  advance(FRAME_MS);
}

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

test("a press steps the viewport, then repeats while it is held", () => {
  const { viewport, scrollDownButton } = renderScrollbar();

  fireEvent.pointerDown(scrollDownButton, { button: 0 });

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX);

  advance(ARROW_STEP_REPEAT_DELAY_MS - 1); // An ordinary press must not outlast the delay and step twice.

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX);

  advance(1);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX * 2);

  advance(ARROW_STEP_REPEAT_INTERVAL_MS);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX * 3);

  fireEvent.pointerUp(scrollDownButton);
  advance(ARROW_STEP_REPEAT_INTERVAL_MS * 4);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX * 3);
});

test("the click event that follows a press does not step a second time", () => {
  const { viewport, scrollDownButton } = renderScrollbar();

  fireEvent.pointerDown(scrollDownButton, { button: 0 });
  fireEvent.pointerUp(scrollDownButton);
  fireEvent.click(scrollDownButton, { detail: 1 });

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX);
});

test("a tap whose touch pointer events do not reach the control still plays a click sound", () => {
  const { viewport, scrollDownButton } = renderScrollbar();

  fireEvent.click(scrollDownButton, { detail: 1 }); // The press landed outside, so only the click arrives.

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX);
});

test("a browser-cancelled press scrolls once, and the following click scrolls again", () => {
  const { viewport, scrollDownButton } = renderScrollbar();

  fireEvent.pointerDown(scrollDownButton, { button: 0 });
  fireEvent.pointerCancel(scrollDownButton);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX);

  fireEvent.click(scrollDownButton, { detail: 1 });

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX * 2);
});

test("a step at the scroll boundary still plays a click sound", () => {
  const { viewport, scrollDownButton } = renderScrollbar();

  viewport.scrollTop = MAX_SCROLL_TOP;
  fireEvent.pointerDown(scrollDownButton, { button: 0 });

  expect(viewport.scrollTop).toBe(MAX_SCROLL_TOP);
  expect(playClick).toHaveBeenCalledTimes(1);
});

test("a keyboard activation steps the viewport", () => {
  const { viewport, scrollDownButton } = renderScrollbar();

  fireEvent.click(scrollDownButton);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX);
});

// A press released outside the arrow does not deliver a click to clear the press it
// recorded, so a keyboard activation must not be mistaken for that press arriving late.
test("a keyboard activation steps the viewport after a press is abandoned outside the arrow", () => {
  const { viewport, scrollDownButton } = renderScrollbar();

  fireEvent.pointerDown(scrollDownButton, { button: 0 });
  fireEvent.pointerLeave(scrollDownButton, { buttons: 1 });

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX);

  fireEvent.click(scrollDownButton);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX * 2);
});

test("a held press keeps scrolling when the pointer leaves the arrow", () => {
  const { viewport, scrollDownButton } = renderScrollbar();

  fireEvent.pointerDown(scrollDownButton, { button: 0 });
  advance(ARROW_STEP_REPEAT_DELAY_MS);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX * 2);

  fireEvent.pointerLeave(scrollDownButton, { buttons: 1 });
  advance(ARROW_STEP_REPEAT_INTERVAL_MS * 2);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX * 4);
});

test("a release away from the arrow ends the press", () => {
  const { viewport, scrollDownButton } = renderScrollbar();

  fireEvent.pointerDown(scrollDownButton, { button: 0 });
  fireEvent.pointerLeave(scrollDownButton, { buttons: 1 });
  fireEvent.pointerUp(document.body);
  advance(ARROW_STEP_REPEAT_DELAY_MS + ARROW_STEP_REPEAT_INTERVAL_MS * 4);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX);
});

test("a press released away from the arrow does not affect the next activation", () => {
  const { viewport, scrollDownButton } = renderScrollbar();

  fireEvent.pointerDown(scrollDownButton, { button: 0 });
  fireEvent.pointerUp(document.body);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX);

  fireEvent.click(scrollDownButton, { detail: 1 }); // A tap iOS redirected to the arrow.

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX * 2);
});

test("a press on the track scrolls to the pressed point and plays a click", () => {
  const { viewport, track } = renderScrollbar();

  pressTrackAt(track, 0.5);

  expect(viewport.scrollTop).toBe(MAX_SCROLL_TOP / 2);
  expect(playClick).toHaveBeenCalledTimes(1);
});

test("a press past either end of the thumb's travel scrolls to that end", () => {
  const { viewport, track } = renderScrollbar();

  pressTrackAt(track, 2);

  expect(viewport.scrollTop).toBe(MAX_SCROLL_TOP);

  pressTrackAt(track, -2);

  expect(viewport.scrollTop).toBe(0);
});

// The thumb sits inside the track and runs its own drag, whose press bubbles through the track.
test("a press on the thumb does not scroll the viewport", () => {
  const { viewport, thumb } = renderScrollbar();

  fireEvent.pointerDown(thumb, { button: 0, clientY: TRACK_TOP + TRACK_HEIGHT });

  expect(viewport.scrollTop).toBe(0);
  expect(playClick).toHaveBeenCalledTimes(1); // The thumb plays its own press sound.
});

test("a secondary press on the track is ignored", () => {
  const { viewport, track } = renderScrollbar();

  fireEvent.pointerDown(track, { button: 2, clientY: TRACK_TOP + TRACK_HEIGHT / 2 });

  expect(viewport.scrollTop).toBe(0);
  expect(playClick).not.toHaveBeenCalled();
});

test("the scroll a track press causes does not play a scroll sound", () => {
  const { viewport, track } = renderScrollbar();

  advance(1);
  viewport.scrollTop = DETENT_PIXELS * 2;
  fireEvent.scroll(viewport);

  expect(playScrollDetent).toHaveBeenCalledTimes(1);

  advance(1);
  pressTrackAt(track, 1);
  fireEvent.scroll(viewport);

  expect(viewport.scrollTop).toBe(MAX_SCROLL_TOP);
  expect(playScrollDetent).toHaveBeenCalledTimes(1);
});

test("a track press transitions into a thumb drag from the point it jumped to", () => {
  const { viewport, track } = renderScrollbar();

  pressTrackAt(track, 0.25);

  expect(viewport.scrollTop).toBe(MAX_SCROLL_TOP * 0.25);

  dragTrackTo(track, 0.75);

  expect(viewport.scrollTop).toBe(MAX_SCROLL_TOP * 0.75);

  fireEvent.pointerUp(track);
  dragTrackTo(track, 0.25); // The release ended the drag, so the pointer no longer scrolls.

  expect(viewport.scrollTop).toBe(MAX_SCROLL_TOP * 0.75);
});

// The press jumps on its own, so pointer jitter must not drag the jump off its mark.
test("a pointer that moves within the drag threshold after a track press does begin a thumb drag", () => {
  const { viewport, track } = renderScrollbar();

  pressTrackAt(track, 0.5);
  fireEvent.pointerMove(track, { buttons: 1, clientY: thumbCentreAt(0.5) + DRAG_THRESHOLD_PX });
  advance(FRAME_MS);

  expect(viewport.scrollTop).toBe(MAX_SCROLL_TOP / 2);
});

test("the scrolling that follows the jump from a thumb press plays scroll sounds", () => {
  const { viewport, track } = renderScrollbar();

  pressTrackAt(track, 1);
  advance(1);
  fireEvent.scroll(viewport);

  expect(viewport.scrollTop).toBe(MAX_SCROLL_TOP);
  expect(playScrollDetent).not.toHaveBeenCalled();

  dragTrackTo(track, 0);
  advance(1);
  fireEvent.scroll(viewport);

  expect(viewport.scrollTop).toBe(0);
  expect(playScrollDetent).toHaveBeenCalledTimes(1);
});
