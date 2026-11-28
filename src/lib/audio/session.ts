import { useEffect } from "react";

import { useEventListeners } from "../hooks/use-event-listeners.ts";

// The Audio Session API, which TypeScript's DOM library does not declare (Safari 16.4 and later).
type AudioSessionType = "auto" | "playback" | "transient" | "transient-solo" | "ambient" | "play-and-record";

interface AudioSession {
  type: AudioSessionType;
}

// `audioTracks` is unavailable in some browsers, which TypeScript's DOM library reflects by omitting it.
type MediaElementWithAudioTracks = HTMLMediaElement & { audioTracks?: { length: number } };

const audioSessionOf = () => (navigator as Navigator & { audioSession?: AudioSession }).audioSession;

// Treats a media element without `audioTracks` as having audio.
const isAudible = (media: MediaElementWithAudioTracks) =>
  !media.paused && !media.muted && media.volume > 0 && media.audioTracks?.length !== 0;

/**
 * Sets the audio session type to `playback` while any media element in the document plays audibly, and to `ambient`
 * otherwise, so sound effects mix with other apps' audio and follow the silent switch.
 *
 * Under the default `auto` type, WebKit switches the session to `playback` when an audible video plays and leaves it
 * there, so later sound effects pause other apps' audio.
 */
export function syncAudioSessionType(): void {
  const audioSession = audioSessionOf();

  if (!audioSession) {
    return;
  }

  const type = Array.from(document.querySelectorAll<HTMLMediaElement>("audio, video")).some(isAudible)
    ? "playback"
    : "ambient";

  if (audioSession.type !== type) {
    audioSession.type = type;
  }
}

/**
 * Syncs the audio session type before a sound effect plays, unless the type is already `ambient`.
 *
 * A media element removed from the document while playing is paused without its `pause` event reaching
 * `useAudioSessionType`, which would leave the type at `playback`. While the type is `ambient`, any media element that
 * starts playing audibly dispatches an event that `useAudioSessionType` receives, so the query is unnecessary.
 */
export function syncAudioSessionTypeForSoundEffect(): void {
  if (audioSessionOf()?.type !== "ambient") {
    syncAudioSessionType();
  }
}

/**
 * Syncs the audio session type on mount and whenever a media element in the document starts, stops, or changes volume.
 */
export function useAudioSessionType() {
  useEffect(syncAudioSessionType, []);

  // Media events do not bubble, so they are received in the capture phase. `playing` follows `play` once data has
  // loaded, when `audioTracks` lists the element's tracks.
  useEventListeners(
    "document",
    {
      play: syncAudioSessionType,
      playing: syncAudioSessionType,
      pause: syncAudioSessionType,
      volumechange: syncAudioSessionType,
    },
    { capture: true },
  );
}
