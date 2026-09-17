import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

import { playClick } from "#/lib/audio/sounds.ts";

import { Video } from "./video.tsx";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal),
);

const DURATION_S = 60;

let playback: { paused: boolean; muted: boolean; currentTime: number };

// jsdom does not load or play media, so playback is simulated on the element's prototype.
beforeEach(() => {
  playback = { paused: true, muted: false, currentTime: 0 };

  vi.mocked(playClick).mockClear();
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
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function play(this: HTMLMediaElement) {
    playback.paused = false;
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function pause(this: HTMLMediaElement) {
    playback.paused = true;
    this.dispatchEvent(new Event("pause"));
  });
});

const renderVideo = () =>
  render(<Video src="/video.mp4" poster="/video.poster.webp" width={640} controls aria-label="A video" />);

test("a video without the `controls` prop renders a `<video>` with its props, without playback controls", () => {
  const { container } = render(<Video src="/video.mp4" autoPlay muted loop aria-label="A video" />);
  const video = container.querySelector("video")!;

  expect(video.getAttribute("src")).toBe("/video.mp4");
  expect(video.hasAttribute("loop")).toBe(true);
  expect(screen.queryByRole("group", { name: "Playback controls" })).toBeNull();
});

test("a video with the `controls` prop renders the site's playback controls in place of the browser's", () => {
  const { container } = renderVideo();
  const video = container.querySelector("video")!;

  expect(video.hasAttribute("controls")).toBe(false);
  expect(screen.getByRole("button", { name: "Play" })).toHaveProperty("disabled", false);
  expect(screen.getByRole("slider", { name: "Seek" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Mute" })).toBeDefined();
});

test("a video with the `controls` prop passes its other props to the `<video>`", () => {
  const { container } = renderVideo();
  const video = container.querySelector("video")!;

  expect(video.getAttribute("poster")).toBe("/video.poster.webp");
  expect(video.getAttribute("width")).toBe("640");
  expect(video.getAttribute("aria-label")).toBe("A video");
});

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
});

test("the playback controls are marked with the `data-feed-omit` attribute", () => {
  renderVideo();
  expect(screen.getByRole("group", { name: "Playback controls" }).hasAttribute("data-feed-omit")).toBe(true);
});

test("the controls show the playing, muted, and current time state that a video has when they mount", () => {
  playback = { paused: false, muted: true, currentTime: 12 };

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

test("the Space key toggles playback and plays a click sound while the focus is on the container or the slider", () => {
  const { container } = renderVideo();

  fireEvent.keyDown(container.querySelector("video")!.parentElement!, { key: " " });

  expect(playback.paused).toBe(false);

  fireEvent.keyDown(screen.getByRole("slider", { name: "Seek" }), { key: " " });

  expect(playback.paused).toBe(true);
  expect(playClick).toHaveBeenCalledTimes(2);
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

test("seeking sets the `--progress` custom property of the slider to the current time as a fraction of the duration", () => {
  renderVideo();

  const slider = screen.getByRole("slider", { name: "Seek" });

  fireEvent.keyDown(slider, { key: "ArrowRight" });
  fireEvent.keyDown(slider, { key: "ArrowRight" });
  fireEvent.keyDown(slider, { key: "ArrowRight" });

  expect(slider.style.getPropertyValue("--progress")).toBe("0.25");
});
