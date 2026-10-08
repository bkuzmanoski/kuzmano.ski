import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { advanceTimersBy } from "#/test-utils/timers.ts";

import { ZOOM_RECT_DURATION_MS, ZoomRect } from "./zoom-rect.tsx";

const FROM_RECT = { x: 10, y: 20, width: 30, height: 40 };
const TARGET_RECT = { x: 100, y: 200, width: 300, height: 400 };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const renderZoomRect = (onDone = vi.fn()) =>
  render(<ZoomRect from={FROM_RECT} target={TARGET_RECT} onDone={onDone} />).container.firstElementChild as HTMLElement;
const boxOf = ({ style: { left, top, width, height } }: HTMLElement) => ({ left, top, width, height });
const advanceToNextFrame = () =>
  act(() => {
    vi.advanceTimersToNextFrame();
  });

describe("ZoomRect", () => {
  test("renders the outline at its `from` prop, and moves it to its `target` prop two animation frames after it mounts", () => {
    const zoomRect = renderZoomRect();

    advanceToNextFrame();

    expect(boxOf(zoomRect)).toEqual({ left: "10px", top: "20px", width: "30px", height: "40px" });

    advanceToNextFrame();

    expect(boxOf(zoomRect)).toEqual({ left: "100px", top: "200px", width: "300px", height: "400px" });
  });

  test("calls its `onDone` prop `ZOOM_RECT_DURATION_MS` after it mounts", () => {
    const onDone = vi.fn();

    renderZoomRect(onDone);
    advanceTimersBy(ZOOM_RECT_DURATION_MS - 1);

    expect(onDone).not.toHaveBeenCalled();

    advanceTimersBy(1);

    expect(onDone).toHaveBeenCalledOnce();
  });
});
