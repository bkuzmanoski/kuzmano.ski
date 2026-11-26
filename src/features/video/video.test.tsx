import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { playClickSound } from "#/lib/audio/sounds.ts";
import { DRAG_THRESHOLD_PX } from "#/lib/press/use-pointer-drag.ts";
import { stubIntersectionObserver } from "#/test-utils/intersection-observer.ts";
import { SECOND_TOUCH_PRESS_INIT } from "#/test-utils/press.ts";
import { advanceTimersBy } from "#/test-utils/timers.ts";

import { Video } from "./video.tsx";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal),
);

const DURATION_S = 60;
const TRACK_WIDTH_PX = 110;
const THUMB_WIDTH_PX = 10;
const FRAME_MS = 16;

let playback: { paused: boolean; muted: boolean; currentTime: number; seeking: boolean };
let isFullScreen: boolean;

beforeEach(() => {
  playback = { paused: true, muted: false, currentTime: 0, seeking: false };
  isFullScreen = false;

  vi.mocked(playClickSound).mockClear();
  vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(DURATION_S);
  vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(() => playback.paused);
  vi.spyOn(HTMLMediaElement.prototype, "muted", "get").mockImplementation(() => playback.muted);
  vi.spyOn(HTMLMediaElement.prototype, "muted", "set").mockImplementation(function setMuted(
    this: HTMLMediaElement,
    value: boolean,
  ) {
    playback.muted = value;
    this.dispatchEvent(new Event("volumechange"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "currentTime", "get").mockImplementation(() => playback.currentTime);
  vi.spyOn(HTMLMediaElement.prototype, "currentTime", "set").mockImplementation((value: number) => {
    playback.currentTime = value;
    playback.seeking = true; // Until `finishSeek`.
  });
  vi.spyOn(HTMLMediaElement.prototype, "seeking", "get").mockImplementation(() => playback.seeking);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function play(this: HTMLMediaElement) {
    playback.paused = false;
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function pause(this: HTMLMediaElement) {
    playback.paused = true;
    this.dispatchEvent(new Event("pause"));
  });

  const setFullScreen = (value: boolean) => {
    isFullScreen = value;
    document.dispatchEvent(new Event("fullscreenchange"));
    return Promise.resolve();
  };
  const requestFullscreen = vi.fn(() => setFullScreen(true));

  Object.defineProperties(document, {
    fullscreenEnabled: { configurable: true, value: true },
    fullscreenElement: {
      configurable: true,
      get: () => (isFullScreen ? requestFullscreen.mock.contexts.at(-1) : null),
    },
    exitFullscreen: { configurable: true, value: () => setFullScreen(false) },
  });
  Object.defineProperty(Element.prototype, "requestFullscreen", { configurable: true, value: requestFullscreen });
});

afterEach(() => vi.useRealTimers());

const renderVideo = () =>
  render(<Video src="/video.mp4" poster="/video.poster.webp" width={640} controls aria-label="A video" />);

/** Renders a video with its slider laid out from `x` = 0, so a pointer at `thumbCenterAt(0.5)` is halfway along it. */
function renderVideoWithLaidOutSlider() {
  vi.useFakeTimers(); // A drag reports its moves on animation frames.

  const { container } = renderVideo();
  const video = container.querySelector("video")!;
  const slider = screen.getByRole("slider", { name: "Seek" });

  Object.defineProperty(slider, "clientWidth", { value: TRACK_WIDTH_PX, configurable: true });
  Object.defineProperty(slider.firstElementChild, "offsetWidth", { value: THUMB_WIDTH_PX, configurable: true });
  slider.getBoundingClientRect = () => new DOMRect(0, 0, TRACK_WIDTH_PX, THUMB_WIDTH_PX);

  return { video, slider };
}

const thumbCenterAt = (position: number) => THUMB_WIDTH_PX / 2 + position * (TRACK_WIDTH_PX - THUMB_WIDTH_PX);

function pressSliderAt(slider: HTMLElement, position: number, { pointerType = "mouse" } = {}) {
  fireEvent.pointerDown(slider, { button: 0, pointerType, clientX: thumbCenterAt(position) });
}

/** Moves the pointer pressed on the slider to `position` along it, `dy` pixels below the slider's top edge. */
function dragSliderTo(slider: HTMLElement, position: number, { dy = 0 } = {}) {
  fireEvent.pointerMove(slider, { buttons: 1, clientX: thumbCenterAt(position), clientY: dy });
  advanceTimersBy(FRAME_MS);
}

/** Positions on the slider for a touch that moves by the drag threshold, and for one that moves past it. */
const POSITION_WITHIN_DRAG_THRESHOLD = 0.25 + DRAG_THRESHOLD_PX / (TRACK_WIDTH_PX - THUMB_WIDTH_PX);
const POSITION_PAST_DRAG_THRESHOLD = 0.5;

/** Ends the gesture as a browser does when it claims a touch to scroll the page. */
const cancelPointer = (slider: HTMLElement) => fireEvent.pointerCancel(slider);

function finishSeek(video: HTMLVideoElement) {
  playback.seeking = false;
  fireEvent(video, new Event("seeked"));
}

test("a video without the `controls` prop renders a `<video>` with its props, without playback controls", () => {
  const { container } = render(<Video src="/video.mp4" autoPlay muted loop aria-label="A video" />);
  const video = container.querySelector("video")!;

  expect(video.getAttribute("src")).toBe("/video.mp4");
  expect(video.hasAttribute("loop")).toBe(true);
  expect(screen.queryByRole("group", { name: "Playback controls" })).toBeNull();
});

test("a video with the `controls` prop renders the site's playback controls in place of the browser's controls", () => {
  const { container } = renderVideo();
  const video = container.querySelector("video")!;

  expect(video.hasAttribute("controls")).toBe(false);
  expect(screen.getByRole("button", { name: "Play" })).toHaveProperty("disabled", false);
  expect(screen.getByRole("slider", { name: "Seek" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Mute" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Enter full screen" })).toHaveProperty("disabled", false);
});

test("a video with the `controls` prop passes its other props to the `<video>`", () => {
  const { container } = renderVideo();
  const video = container.querySelector("video")!;

  expect(video.getAttribute("poster")).toBe("/video.poster.webp");
  expect(video.getAttribute("width")).toBe("640");
  expect(video.getAttribute("aria-label")).toBe("A video");
});

test.each([
  { name: "data-content-span", value: "pane" },
  { name: "data-content-space", value: "loose" },
])(
  "a video with the `controls` prop sets the `$name` attribute on its container rather than its `<video>`",
  ({ name, value }) => {
    const { container } = render(<Video src="/video.mp4" controls aria-label="A video" {...{ [name]: value }} />);
    const videoContainer = container.firstElementChild!;
    const video = container.querySelector("video")!;

    expect(videoContainer.getAttribute(name)).toBe(value);
    expect(video.hasAttribute(name)).toBe(false);
  },
);

test("a video with the `controls` prop forwards its `ref` prop to the `<video>`", () => {
  const ref = createRef<HTMLVideoElement>();
  const { container } = render(<Video src="/video.mp4" controls aria-label="A video" ref={ref} />);

  expect(ref.current).toBe(container.querySelector("video"));
});

test("the server render of a video with the `controls` prop includes the `controls` attribute, and disables the playback control buttons", () => {
  const html = renderToString(<Video src="/video.mp4" controls aria-label="A video" />);
  const container = document.createElement("div");

  container.innerHTML = html;

  expect(container.querySelector("video")!.hasAttribute("controls")).toBe(true);
  expect(container.querySelector("[aria-label='Play']")).toHaveProperty("disabled", true);
  expect(container.querySelector("[aria-label='Mute']")).toHaveProperty("disabled", true);
  expect(container.querySelector("[aria-label='Enter full screen']")).toHaveProperty("disabled", true);
});

test("the playback controls are marked with the `data-feed-omit` attribute", () => {
  renderVideo();
  expect(screen.getByRole("group", { name: "Playback controls" }).hasAttribute("data-feed-omit")).toBe(true);
});

test("the controls show the playing, muted, and current time state that a video has when they mount", () => {
  playback = { paused: false, muted: true, currentTime: 12, seeking: false };

  renderVideo();

  expect(screen.getByRole("button", { name: "Pause" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Unmute" })).toBeDefined();
  expect(screen.getByRole("slider", { name: "Seek" }).getAttribute("aria-valuetext")).toBe("0:12 of 1:00");
});

test("the Play button plays the video, and becomes a Pause button that pauses it", () => {
  renderVideo();

  fireEvent.click(screen.getByRole("button", { name: "Play" }));

  expect(playback.paused).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: "Pause" }));

  expect(playback.paused).toBe(true);
  expect(screen.getByRole("button", { name: "Play" })).toBeDefined();
});

test("the Mute button mutes the video, and becomes an Unmute button that unmutes it", () => {
  renderVideo();

  fireEvent.click(screen.getByRole("button", { name: "Mute" }));

  expect(playback.muted).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Unmute" }));

  expect(playback.muted).toBe(false);
});

test("the Enter Full Screen button makes the container full screen, and becomes an Exit Full Screen button that exits full screen", () => {
  const { container } = renderVideo();

  fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));

  expect(document.fullscreenElement).toBe(container.firstElementChild);

  fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));

  expect(document.fullscreenElement).toBeNull();
  expect(screen.getByRole("button", { name: "Enter full screen" })).toBeDefined();
});

test("the Enter Full Screen button enters the native full screen player of the `<video>` where the Fullscreen API is unavailable", () => {
  const webkitEnterFullscreen = vi.fn();

  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: undefined });
  Object.defineProperty(HTMLVideoElement.prototype, "webkitEnterFullscreen", {
    configurable: true,
    value: webkitEnterFullscreen,
  });

  try {
    renderVideo();
    fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));

    expect(webkitEnterFullscreen).toHaveBeenCalledOnce();
  } finally {
    Reflect.deleteProperty(HTMLVideoElement.prototype, "webkitEnterFullscreen");
  }
});

test("pressing on the video toggles playback", () => {
  const { container } = renderVideo();
  const video = container.querySelector("video")!;

  fireEvent.click(video);

  expect(playback.paused).toBe(false);

  fireEvent.click(video);

  expect(playback.paused).toBe(true);
});

test("pressing on the video focuses its container", () => {
  const { container } = renderVideo();
  const video = container.querySelector("video")!;

  fireEvent.pointerDown(video);

  expect(document.activeElement).toBe(video.parentElement);
});

test("the Space key toggles playback and plays the click sound while the focus is on the container or the slider", () => {
  const { container } = renderVideo();

  fireEvent.keyDown(container.querySelector("video")!.parentElement!, { key: " " });

  expect(playback.paused).toBe(false);

  fireEvent.keyDown(screen.getByRole("slider", { name: "Seek" }), { key: " " });

  expect(playback.paused).toBe(true);
  expect(playClickSound).toHaveBeenCalledTimes(2);
});

test("the Space key does not toggle playback or prevent its default action while the focus is on a button", () => {
  renderVideo();

  const muteButton = screen.getByRole("button", { name: "Mute" });

  expect(fireEvent.keyDown(muteButton, { key: " " })).toBe(true); // The default behavior is left to activate the button.
  expect(playback.paused).toBe(true);
});

test("the Left and Right arrow keys seek five seconds backward or forward, within the bounds of the video", () => {
  renderVideo();

  const slider = screen.getByRole("slider", { name: "Seek" });

  fireEvent.keyDown(slider, { key: "ArrowRight" });

  expect(playback.currentTime).toBe(5);

  fireEvent.keyDown(slider, { key: "ArrowLeft" });
  fireEvent.keyDown(slider, { key: "ArrowLeft" });

  expect(playback.currentTime).toBe(0);

  playback.currentTime = DURATION_S - 2;
  fireEvent.keyDown(slider, { key: "ArrowRight" });

  expect(playback.currentTime).toBe(DURATION_S);
});

test("the Left and Right arrow keys seek while the focus is on a playback control button", () => {
  renderVideo();

  fireEvent.keyDown(screen.getByRole("button", { name: "Play" }), { key: "ArrowRight" });
  fireEvent.keyDown(screen.getByRole("button", { name: "Mute" }), { key: "ArrowRight" });

  expect(playback.currentTime).toBe(10);
});

test("the Up and Down arrow keys seek only while the focus is on the slider", () => {
  renderVideo();

  fireEvent.keyDown(screen.getByRole("button", { name: "Play" }), { key: "ArrowUp" });

  expect(playback.currentTime).toBe(0);

  fireEvent.keyDown(screen.getByRole("slider", { name: "Seek" }), { key: "ArrowUp" });

  expect(playback.currentTime).toBe(5);

  fireEvent.keyDown(screen.getByRole("slider", { name: "Seek" }), { key: "ArrowDown" });

  expect(playback.currentTime).toBe(0);
});

test("the Home and End keys seek to the start and end of the video", () => {
  renderVideo();

  const slider = screen.getByRole("slider", { name: "Seek" });

  fireEvent.keyDown(slider, { key: "End" });

  expect(playback.currentTime).toBe(DURATION_S);
  expect(slider.getAttribute("aria-valuetext")).toBe("1:00 of 1:00");

  fireEvent.keyDown(slider, { key: "Home" });

  expect(playback.currentTime).toBe(0);
});

test("pressing an arrow key with a modifier key does not seek the video", () => {
  renderVideo();

  fireEvent.keyDown(screen.getByRole("slider", { name: "Seek" }), { key: "ArrowRight", metaKey: true });
  fireEvent.keyDown(screen.getByRole("slider", { name: "Seek" }), { key: "ArrowRight", altKey: true });

  expect(playback.currentTime).toBe(0);
});

test("dragging the slider seeks the video to the time under the pointer", () => {
  const { video, slider } = renderVideoWithLaidOutSlider();

  pressSliderAt(slider, 0.25);

  expect(playback.currentTime).toBe(15);

  finishSeek(video);
  dragSliderTo(slider, 0.5);

  expect(playback.currentTime).toBe(30);

  fireEvent.pointerUp(slider);

  expect(playback.currentTime).toBe(30);
});

test("dragging the slider starts a seek only after the previous one finishes, then seeks to the latest time under the pointer", () => {
  const { video, slider } = renderVideoWithLaidOutSlider();

  pressSliderAt(slider, 0.25);
  dragSliderTo(slider, 0.5);
  dragSliderTo(slider, 0.75);

  expect(playback.currentTime).toBe(15);
  expect(slider.getAttribute("aria-valuetext")).toBe("0:45 of 1:00"); // The thumb follows the pointer meanwhile.

  finishSeek(video);

  expect(playback.currentTime).toBe(45);
});

test("dragging the slider seeks with `fastSeek` where the browser provides it, then to the exact time when the user releases the slider", () => {
  const KEYFRAME_INTERVAL_S = 10;
  const fastSeek = vi.fn((seconds: number) => {
    playback.currentTime = Math.floor(seconds / KEYFRAME_INTERVAL_S) * KEYFRAME_INTERVAL_S;
    playback.seeking = true;
  });

  Object.defineProperty(HTMLMediaElement.prototype, "fastSeek", { configurable: true, value: fastSeek });

  try {
    const { slider } = renderVideoWithLaidOutSlider();

    pressSliderAt(slider, 0.25);

    expect(fastSeek).toHaveBeenCalledWith(15);
    expect(playback.currentTime).toBe(10);

    fireEvent.pointerUp(slider);

    expect(playback.currentTime).toBe(15);
  } finally {
    Reflect.deleteProperty(HTMLMediaElement.prototype, "fastSeek");
  }
});

test("pressing on the slider pauses a playing video until the user releases it, without changing the Pause button to a Play button", () => {
  const { slider } = renderVideoWithLaidOutSlider();

  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  pressSliderAt(slider, 0.25);

  expect(playback.paused).toBe(true);
  expect(screen.getByRole("button", { name: "Pause" })).toBeDefined();

  fireEvent.pointerUp(slider);

  expect(playback.paused).toBe(false);
  expect(screen.getByRole("button", { name: "Pause" })).toBeDefined();
});

test("releasing the slider leaves a paused video paused", () => {
  const { slider } = renderVideoWithLaidOutSlider();

  pressSliderAt(slider, 0.25);
  fireEvent.pointerUp(slider);

  expect(playback.paused).toBe(true);
  expect(screen.getByRole("button", { name: "Play" })).toBeDefined();
});

test("releasing the slider at the end of the video leaves a playing video paused", () => {
  const { slider } = renderVideoWithLaidOutSlider();

  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  pressSliderAt(slider, 1);
  fireEvent.pointerUp(slider);

  expect(playback.currentTime).toBe(DURATION_S);
  expect(playback.paused).toBe(true);
  expect(screen.getByRole("button", { name: "Play" })).toBeDefined();
});

test("a mouse press on the slider plays the click sound and focuses the slider before the pointer moves", () => {
  const { slider } = renderVideoWithLaidOutSlider();

  pressSliderAt(slider, 0.25);

  expect(playClickSound).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(slider);
});

test("a mouse scrub canceled by the browser returns the video to the time it started from", () => {
  const { video, slider } = renderVideoWithLaidOutSlider();

  playback.currentTime = 6;
  pressSliderAt(slider, 0.25);

  expect(playback.currentTime).toBe(15);

  finishSeek(video);
  cancelPointer(slider);

  expect(playback.currentTime).toBe(6);
});

test("a touch press on the slider does not seek, pause playback, play the click sound, or take the focus until it moves horizontally past the drag threshold", () => {
  const { slider } = renderVideoWithLaidOutSlider();

  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  pressSliderAt(slider, 0.25, { pointerType: "touch" });
  dragSliderTo(slider, POSITION_WITHIN_DRAG_THRESHOLD, { dy: 40 }); // A vertical swipe that the browser can claim.

  expect(playback.currentTime).toBe(0);
  expect(playback.paused).toBe(false);
  expect(playClickSound).not.toHaveBeenCalled();
  expect(document.activeElement).not.toBe(slider);

  dragSliderTo(slider, POSITION_PAST_DRAG_THRESHOLD);

  expect(playback.currentTime).toBe(30);
  expect(playback.paused).toBe(true);
  expect(playClickSound).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(slider);
});

test("a touch press on the slider that moves further vertically than horizontally does not seek, play the click sound, or take the focus", () => {
  const { slider } = renderVideoWithLaidOutSlider();

  pressSliderAt(slider, 0.25, { pointerType: "touch" });
  dragSliderTo(slider, POSITION_PAST_DRAG_THRESHOLD, { dy: 40 }); // A diagonal swipe that the browser can claim.

  expect(playback.currentTime).toBe(0);
  expect(playClickSound).not.toHaveBeenCalled();
  expect(document.activeElement).not.toBe(slider);
});

test("a touch press on the slider canceled by the browser before it moves past the drag threshold does not seek or play the click sound", () => {
  const { slider } = renderVideoWithLaidOutSlider();

  pressSliderAt(slider, 0.25, { pointerType: "touch" });
  dragSliderTo(slider, 0.25, { dy: 40 });
  cancelPointer(slider);

  expect(playback.currentTime).toBe(0);
  expect(playClickSound).not.toHaveBeenCalled();
});

test("a touch scrub canceled by the browser returns the video to the time it started from and resumes playback", () => {
  const { video, slider } = renderVideoWithLaidOutSlider();

  playback.currentTime = 6;
  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  pressSliderAt(slider, 0.25, { pointerType: "touch" });
  dragSliderTo(slider, POSITION_PAST_DRAG_THRESHOLD);

  expect(playback.currentTime).toBe(30);

  finishSeek(video);
  cancelPointer(slider);

  expect(playback.currentTime).toBe(6);
  expect(playback.paused).toBe(false);
  expect(screen.getByRole("button", { name: "Pause" })).toBeDefined();
});

test("a second touch that lands in the frame of the first touch's move prevents the seek and the click sound", () => {
  const { slider } = renderVideoWithLaidOutSlider();

  playback.currentTime = 6;
  pressSliderAt(slider, 0.25, { pointerType: "touch" });
  fireEvent.pointerMove(slider, { buttons: 1, clientX: thumbCenterAt(POSITION_PAST_DRAG_THRESHOLD), clientY: 0 });
  fireEvent.pointerDown(slider, SECOND_TOUCH_PRESS_INIT);
  advanceTimersBy(FRAME_MS);

  expect(playClickSound).not.toHaveBeenCalled();
  expect(playback.currentTime).toBe(6);
});

test("a tap on the slider seeks to the time under the touch point and plays the click sound on its `click` event", () => {
  const { slider } = renderVideoWithLaidOutSlider();

  playback.currentTime = 6;
  pressSliderAt(slider, 0.25, { pointerType: "touch" });
  fireEvent.pointerUp(slider);

  expect(playback.currentTime).toBe(6);
  expect(playClickSound).not.toHaveBeenCalled();

  fireEvent.click(slider, { detail: 1 });

  expect(playback.currentTime).toBe(15);
  expect(playClickSound).toHaveBeenCalledOnce();
});

test("a tap on the slider followed by a `click` event on a nearby control does not seek", () => {
  const { slider } = renderVideoWithLaidOutSlider();

  playback.currentTime = 6;
  pressSliderAt(slider, 0.25, { pointerType: "touch" });
  fireEvent.pointerUp(slider);
  fireEvent.click(screen.getByRole("button", { name: "Mute" }), { detail: 1 });

  expect(playback.currentTime).toBe(6);
});

test("seeking sets the `--video-progress` custom property of the slider to the current time as a fraction of the duration", () => {
  renderVideo();

  const slider = screen.getByRole("slider", { name: "Seek" });

  fireEvent.keyDown(slider, { key: "ArrowRight" });
  fireEvent.keyDown(slider, { key: "ArrowRight" });
  fireEvent.keyDown(slider, { key: "ArrowRight" });

  expect(slider.style.getPropertyValue("--video-progress")).toBe("0.25");
});

test("the slider follows playback on animation frames only while in view", () => {
  vi.useFakeTimers();

  const reportIntersection = stubIntersectionObserver();

  renderVideo();

  const slider = screen.getByRole("slider", { name: "Seek" });
  const followOneFrameTo = (currentTime: number) => {
    playback.currentTime = currentTime;
    advanceTimersBy(FRAME_MS);
  };

  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  reportIntersection(slider, true);
  followOneFrameTo(6);

  expect(slider.style.getPropertyValue("--video-progress")).toBe("0.1");
  expect(slider.getAttribute("aria-valuenow")).toBe("6");

  reportIntersection(slider, false);
  followOneFrameTo(12);

  expect(slider.style.getPropertyValue("--video-progress")).toBe("0.1");
  expect(slider.getAttribute("aria-valuenow")).toBe("6");

  reportIntersection(slider, true);
  followOneFrameTo(18);

  expect(slider.style.getPropertyValue("--video-progress")).toBe("0.3");
  expect(slider.getAttribute("aria-valuenow")).toBe("18");
});

test("a `timeupdate` event moves the slider to the current time while it is out of view", () => {
  const { container } = renderVideo();
  const slider = screen.getByRole("slider", { name: "Seek" });

  // The `IntersectionObserver` mock in `vitest.setup.ts` does not report visibility, leaving the slider out of view.
  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  playback.currentTime = 12;
  fireEvent(container.querySelector("video")!, new Event("timeupdate"));

  expect(slider.style.getPropertyValue("--video-progress")).toBe("0.2");
  expect(slider.getAttribute("aria-valuenow")).toBe("12");
});
