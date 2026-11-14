import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { playClickSound } from "#/lib/audio/sounds.ts";
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

function pressSliderAt(slider: HTMLElement, position: number) {
  fireEvent.pointerDown(slider, { button: 0, clientX: thumbCenterAt(position) });
}

function dragSliderTo(slider: HTMLElement, position: number) {
  fireEvent.pointerMove(slider, { buttons: 1, clientX: thumbCenterAt(position) });
  advanceTimersBy(FRAME_MS);
}

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

test("seeking sets the `--video-progress` custom property of the slider to the current time as a fraction of the duration", () => {
  renderVideo();

  const slider = screen.getByRole("slider", { name: "Seek" });

  fireEvent.keyDown(slider, { key: "ArrowRight" });
  fireEvent.keyDown(slider, { key: "ArrowRight" });
  fireEvent.keyDown(slider, { key: "ArrowRight" });

  expect(slider.style.getPropertyValue("--video-progress")).toBe("0.25");
});
