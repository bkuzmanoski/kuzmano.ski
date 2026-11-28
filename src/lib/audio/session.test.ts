import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { syncAudioSessionType, syncAudioSessionTypeForSoundEffect, useAudioSessionType } from "./session.ts";

const audioSession = { type: "auto" };

beforeEach(() => {
  audioSession.type = "auto";
  Object.defineProperty(navigator, "audioSession", { value: audioSession, configurable: true });
});

afterEach(() => {
  document.body.replaceChildren();
});

// Appends a `<video>` that plays with sound, which each test changes to the case it covers.
function appendPlayingVideo() {
  const video = document.createElement("video");

  Object.defineProperty(video, "paused", { value: false, configurable: true });
  Object.defineProperty(video, "audioTracks", { value: { length: 1 }, configurable: true });
  document.body.append(video);

  return video;
}

describe("syncAudioSessionType", () => {
  test("sets the type to `playback` while a video plays with sound", () => {
    appendPlayingVideo();
    syncAudioSessionType();

    expect(audioSession.type).toBe("playback");
  });

  test("sets the type to `ambient` without a media element", () => {
    syncAudioSessionType();
    expect(audioSession.type).toBe("ambient");
  });

  test.each([
    ["paused", (video: HTMLVideoElement) => Object.defineProperty(video, "paused", { value: true })],
    ["muted", (video: HTMLVideoElement) => (video.muted = true)],
    ["at a volume of 0", (video: HTMLVideoElement) => (video.volume = 0)],
    [
      "without audio tracks",
      (video: HTMLVideoElement) => Object.defineProperty(video, "audioTracks", { value: { length: 0 } }),
    ],
  ])("sets the type to `ambient` while the only video is %s", (_case, change) => {
    change(appendPlayingVideo());
    syncAudioSessionType();

    expect(audioSession.type).toBe("ambient");
  });
});

describe("syncAudioSessionTypeForSoundEffect", () => {
  test("sets the type to `ambient` when it is `playback` and no media element plays with sound", () => {
    audioSession.type = "playback"; // A video removed from the document while playing leaves the type at `playback`.

    syncAudioSessionTypeForSoundEffect();

    expect(audioSession.type).toBe("ambient");
  });

  test("does not change the type while it is `ambient`", () => {
    audioSession.type = "ambient";

    appendPlayingVideo(); // Without its `play` event, so only a query of the document would find it.
    syncAudioSessionTypeForSoundEffect();

    expect(audioSession.type).toBe("ambient");
  });
});

describe("useAudioSessionType", () => {
  test("sets the type to `ambient` on mount", () => {
    renderHook(useAudioSessionType);
    expect(audioSession.type).toBe("ambient");
  });

  test.each(["play", "playing", "pause", "volumechange"])(
    "syncs the type when a media element dispatches `%s`",
    (eventType) => {
      renderHook(useAudioSessionType);

      const video = appendPlayingVideo();

      fireEvent(video, new Event(eventType)); // Does not bubble, matching the browser's media events.

      expect(audioSession.type).toBe("playback");
    },
  );
});
