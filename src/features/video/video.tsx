import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

import FullScreenEnterVideoIcon from "#/assets/images/video-icon-full-screen-enter.svg?react";
import FullScreenExitVideoIcon from "#/assets/images/video-icon-full-screen-exit.svg?react";
import PauseVideoIcon from "#/assets/images/video-icon-pause.svg?react";
import PlayVideoIcon from "#/assets/images/video-icon-play.svg?react";
import SoundOffVideoIcon from "#/assets/images/video-icon-sound-off.svg?react";
import SoundOnVideoIcon from "#/assets/images/video-icon-sound-on.svg?react";
import { IconButton } from "#/components/icon-button.tsx";
import { loopAnimationFrames } from "#/lib/animation-frames.ts";
import { playClickSound } from "#/lib/audio/sounds.ts";
import { cx } from "#/lib/class-names.ts";
import { formatPlaybackTime } from "#/lib/datetime.ts";
import { focusWithTabIndexUntilBlur } from "#/lib/focus.ts";
import { useClientValue, useIsHydrated } from "#/lib/hooks/use-client-value.ts";
import { useEventListeners } from "#/lib/hooks/use-event-listeners.ts";
import { clamp } from "#/lib/math.ts";
import { mergeRefs } from "#/lib/merge-refs.ts";
import { useAxisDrag } from "#/lib/press/use-axis-drag.ts";

import styles from "./video.module.css";

import type { ComponentProps, KeyboardEvent } from "react";

const SEEK_STEP_S = 5;

interface WebKitVideoElement extends HTMLVideoElement {
  /** Safari on iPhone supports fullscreen only for `<video>` elements via its native player. */
  webkitEnterFullscreen?: () => void;
}

interface Scrub {
  /** Whether playback was active when dragging began, so it can resume when dragging ends. */
  wasPlaying: boolean;
  /** Playback time to restore if the scrub is canceled. */
  startSeconds: number;
  /** Playback time at the current pointer position. */
  targetSeconds: number;
  /** Most recently requested seek time, or `null` before the first seek. */
  requestedSeconds: number | null;
}

interface SliderPress {
  x: number;
  trackLeft: number;
}

type FrameLoadState = "unloaded" | "loading" | "loaded";

const LAYOUT_ATTRIBUTE_PREFIX = "data-content-";

type LayoutAttributes = Record<`${typeof LAYOUT_ATTRIBUTE_PREFIX}${string}`, unknown>;
type ControlledVideoProps = Omit<ComponentProps<"video">, "controls"> & Partial<LayoutAttributes>;

const canEnterFullScreen = () =>
  Boolean(document.fullscreenEnabled) || "webkitEnterFullscreen" in HTMLVideoElement.prototype;

function partitionLayoutAttributes(props: ControlledVideoProps) {
  const layoutAttributes: LayoutAttributes = {};
  const videoProps: Record<string, unknown> = {};

  for (const [name, value] of Object.entries(props)) {
    if (name.startsWith(LAYOUT_ATTRIBUTE_PREFIX)) {
      layoutAttributes[name as keyof LayoutAttributes] = value;
    } else {
      videoProps[name] = value;
    }
  }

  return { layoutAttributes, videoProps: videoProps as Omit<ComponentProps<"video">, "controls"> };
}

export function Video({ controls, playsInline = true, ...props }: ComponentProps<"video">) {
  return controls ? (
    <ControlledVideo playsInline={playsInline} {...props} />
  ) : (
    <video playsInline={playsInline} {...props} />
  );
}

function ControlledVideo({ className, style, onClick, onPointerDown, ref, ...props }: ControlledVideoProps) {
  const { layoutAttributes, videoProps } = partitionLayoutAttributes(props);
  const [isPaused, setIsPaused] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [hasVideoFrame, setHasVideoFrame] = useState(false);
  const [currentSecond, setCurrentSecond] = useState(0);
  const [duration, setDuration] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<Scrub | null>(null);
  const durationRef = useRef(0);
  const pendingSeekSecondsRef = useRef<number | null>(null);
  const frameLoadStateRef = useRef<FrameLoadState>("unloaded");

  const hasSiteControls = useIsHydrated();
  const canToggleFullScreen = useClientValue(false, canEnterFullScreen);

  const hasDuration = duration > 0;
  const poster = videoProps.poster;
  const isPosterOverlayVisible = Boolean(poster) && hasSiteControls && !hasVideoFrame;

  const syncPosition = (video: HTMLVideoElement) => {
    const seconds = scrubRef.current?.targetSeconds ?? pendingSeekSecondsRef.current ?? video.currentTime;
    const totalDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : durationRef.current;
    const progress = totalDuration > 0 ? seconds / totalDuration : 0;

    trackRef.current?.style.setProperty("--video-progress", String(clamp(progress, 0, 1)));
    setCurrentSecond(Math.floor(seconds));
  };

  const syncState = () => {
    const video = videoRef.current;

    if (video) {
      if (!scrubRef.current) {
        setIsPaused(video.paused);
      }

      setIsMuted(video.muted);

      if (Number.isFinite(video.duration)) {
        durationRef.current = video.duration;
        setDuration(video.duration);
      } else if (pendingSeekSecondsRef.current === null) {
        durationRef.current = 0;
        setDuration(0);
      }

      syncPosition(video);
    }
  };

  const syncInitialState = useEffectEvent(() => {
    const video = videoRef.current;

    if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      frameLoadStateRef.current = "loaded";

      if (!video.paused || video.currentTime > 0) {
        setHasVideoFrame(true);
      }
    }

    syncState();
  });

  // Media events that fired before hydration were missed, so the state is read from the element before it paints.
  useLayoutEffect(() => {
    syncInitialState();
  }, []);

  // Update the thumb every frame for smooth playback as `timeupdate` alone fires too infrequently. The runs loop only
  // while the slider is visible, as audio continues even if the video is scrolled out of view. `timeupdate` keeps the
  // thumb's position and value current while it is out of view.
  useEffect(() => {
    const track = trackRef.current;

    if (isPaused || !track) {
      return;
    }

    let stopLoop: (() => void) | null = null;

    const observer = new IntersectionObserver((entries) => {
      // The last entry is the current one when the slider crossed the root's edge more than once since the last report.
      if (entries.at(-1)?.isIntersecting) {
        if (!stopLoop) {
          stopLoop = loopAnimationFrames(() => {
            if (videoRef.current) {
              syncPosition(videoRef.current);
            }
          });
        }
      } else {
        stopLoop?.();
        stopLoop = null;
      }
    });

    observer.observe(track);

    return () => {
      observer.disconnect();
      stopLoop?.();
    };
  }, [isPaused]);

  // Keep the poster overlay over the `<video>` until playback renders a frame, as Safari on iOS hides the native
  // `poster` attribute as soon as `play()` runs, flashing the element's background before the first frame decodes.
  useEffect(() => {
    const video = videoRef.current;

    if (!poster || hasVideoFrame || isPaused || !video) {
      return;
    }

    const revealFrame = () => setHasVideoFrame(true);

    if (typeof video.requestVideoFrameCallback === "function") {
      const frameCallbackId = video.requestVideoFrameCallback(revealFrame);

      return () => video.cancelVideoFrameCallback(frameCallbackId);
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const frameId = requestAnimationFrame(revealFrame);

      return () => cancelAnimationFrame(frameId);
    }

    video.addEventListener("playing", revealFrame, { once: true });

    return () => video.removeEventListener("playing", revealFrame);
  }, [poster, hasVideoFrame, isPaused]);

  useEventListeners("document", {
    fullscreenchange: () => setIsFullScreen(document.fullscreenElement === containerRef.current),
  });

  const onWebKitEndFullScreen = useEffectEvent(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    // Safari on iOS can leave native inline controls overlaid over the video after exiting native full screen even when
    // the `controls` attribute is absent. Toggling `controls` forces WebKit to remove them.
    video.controls = true;
    video.controls = false;

    syncState();
  });

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.addEventListener("webkitendfullscreen", onWebKitEndFullScreen);

    return () => video.removeEventListener("webkitendfullscreen", onWebKitEndFullScreen);
  }, []);

  // Returns whether a frame has loaded since mount or the last `emptied` event.
  function hasLoadedFrames(video: HTMLVideoElement) {
    // Chrome may temporarily report `HAVE_METADATA` during a seek. Treating that as unloaded could reload the video
    // when the network is idle or leave a pending seek unresolved when the network is loading, because `loadeddata` may
    // not fire again.
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      frameLoadStateRef.current = "loaded";
    }

    return frameLoadStateRef.current === "loaded";
  }

  // Defers a seek until media frames arrive. Safari on iOS stops fetching after `HAVE_METADATA` (`NETWORK_IDLE`), so
  // setting `currentTime` before frames load leaves `seeking` stuck at `true` without updating the displayed frame
  // until playback begins. Calling `load()` fetches frames so `onLoadedData` can apply the seek while paused.
  function deferSeekUntilLoaded(video: HTMLVideoElement, seconds: number) {
    pendingSeekSecondsRef.current = seconds;

    // A load in progress reports `NETWORK_LOADING`, so checking `!== "loaded"` still calls `load()` once while letting
    // a user-initiated seek retry if a non-gesture `load()` from `onSuspend` was ignored.
    if (frameLoadStateRef.current !== "loaded" && video.networkState === HTMLMediaElement.NETWORK_IDLE) {
      frameLoadStateRef.current = "loading";
      video.load();
    }
  }

  function seekOrDefer(video: HTMLVideoElement, seconds: number) {
    if (hasLoadedFrames(video)) {
      pendingSeekSecondsRef.current = null;
      video.currentTime = seconds;
    } else {
      deferSeekUntilLoaded(video, seconds);
    }
  }

  function togglePlayback() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.paused) {
      video.play().catch(() => undefined); // A rejected play leaves the video paused, which the controls already show.
    } else {
      video.pause();
    }
  }

  function seekTo(seconds: number) {
    const video = videoRef.current;

    if (video && hasDuration) {
      seekOrDefer(video, clamp(seconds, 0, duration));
      syncPosition(video);
    }
  }

  function startScrub() {
    const video = videoRef.current;

    if (video) {
      const startSeconds = pendingSeekSecondsRef.current ?? video.currentTime;

      scrubRef.current = {
        wasPlaying: !video.paused,
        startSeconds,
        targetSeconds: startSeconds,
        requestedSeconds: null,
      };
      video.pause();
    }
  }

  // Seeks to the latest scrub target once the current seek finishes; `onSeeked` calls this again if the pointer moved
  // during the seek. Updating `currentTime` mid-seek cancels it and can prevent frames from rendering, and
  // `currentTime` (unlike `fastSeek`) updates frames even in short videos with sparse keyframes.
  function seekToScrubTarget(video: HTMLVideoElement, scrub: Scrub) {
    if (!hasLoadedFrames(video)) {
      deferSeekUntilLoaded(video, scrub.targetSeconds);
      return;
    }

    pendingSeekSecondsRef.current = null;

    if (video.seeking || scrub.requestedSeconds === scrub.targetSeconds) {
      return;
    }

    scrub.requestedSeconds = scrub.targetSeconds;
    video.currentTime = scrub.targetSeconds;
  }

  function scrubToPointer(clientX: number, trackLeft: number) {
    const video = videoRef.current;
    const scrub = scrubRef.current;
    const trackWidth = trackRef.current?.clientWidth ?? 0;
    const thumbWidth = thumbRef.current?.offsetWidth ?? 0;
    const travel = trackWidth - thumbWidth;

    if (video && scrub && travel > 0) {
      scrub.targetSeconds = clamp((clientX - trackLeft - thumbWidth / 2) / travel, 0, 1) * duration;
      seekToScrubTarget(video, scrub);
      syncPosition(video);
    }
  }

  // Ends the scrub at its target, or restores the starting time if the browser canceled the gesture.
  function endScrub({ isCanceled }: { isCanceled: boolean }) {
    const video = videoRef.current;
    const scrub = scrubRef.current;

    scrubRef.current = null;

    if (!video || !scrub) {
      return;
    }

    const endSeconds = isCanceled ? scrub.startSeconds : scrub.targetSeconds;

    seekOrDefer(video, endSeconds);

    // Playing a video from its end restarts it from the beginning.
    if (scrub.wasPlaying && endSeconds < duration) {
      video.play().catch(() => undefined); // `syncState` below reflects a rejected play as paused.
    }

    syncState();
  }

  function toggleMuted() {
    const video = videoRef.current;

    if (video) {
      video.muted = !video.muted;
    }
  }

  function toggleFullScreen() {
    const video: WebKitVideoElement | null = videoRef.current;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else if (document.fullscreenEnabled) {
      containerRef.current?.requestFullscreen().catch(() => undefined);
    } else if (video?.webkitEnterFullscreen) {
      try {
        video.webkitEnterFullscreen();
      } catch {
        // Ignored (Safari throws `InvalidStateError` before metadata loads, e.g., while `load()` is in flight).
      }
    }
  }

  // The track lets the browser claim a vertical touch to scroll the page, so a touch press waits to begin the scrub
  // (see `useAxisDrag`).
  const { ref: trackDragRef, ...trackHandlers } = useAxisDrag<SliderPress>({
    axis: "x",
    preventDefault: true,
    canStart: () => hasDuration,
    start: (event) => ({ x: event.clientX, trackLeft: event.currentTarget.getBoundingClientRect().left }),
    onBegin: (press, { dx }) => {
      playClickSound();
      trackRef.current?.focus({ preventScroll: true });
      startScrub();
      scrubToPointer(press.x + dx, press.trackLeft);
    },
    onDragMove: ({ dx }, press) => scrubToPointer(press.x + dx, press.trackLeft),
    onEnd: ({ isCanceled }) => endScrub({ isCanceled }),
  });

  function onKeyDown(event: KeyboardEvent) {
    if (!hasSiteControls || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const currentTime = pendingSeekSecondsRef.current ?? videoRef.current?.currentTime ?? 0;
    const isOnTrack = event.target === trackRef.current;
    const seekTargets: Partial<Record<string, number>> = {
      ArrowLeft: currentTime - SEEK_STEP_S,
      ArrowRight: currentTime + SEEK_STEP_S,
      ...(isOnTrack && {
        ArrowDown: currentTime - SEEK_STEP_S,
        ArrowUp: currentTime + SEEK_STEP_S,
        Home: 0,
        End: duration,
      }),
    };
    const seekTarget = seekTargets[event.key];

    if (event.key === " " && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      playClickSound();
      togglePlayback();
    } else if (seekTarget !== undefined && hasDuration) {
      event.preventDefault();
      seekTo(seekTarget);
    }
  }

  return (
    <div
      ref={containerRef}
      className={cx(styles.video, className)}
      style={style}
      data-content-panel
      {...layoutAttributes}
      onKeyDown={onKeyDown}
    >
      <video
        ref={mergeRefs(ref, videoRef)}
        {...videoProps}
        controls={!hasSiteControls}
        onPointerDown={(event) => {
          onPointerDown?.(event);

          if (containerRef.current) {
            // The container has no name of its own, so it is focusable only from a press on the video, after which it
            // receives the keys that control playback.
            focusWithTabIndexUntilBlur(containerRef.current, { preventScroll: true });
          }
        }}
        onClick={(event) => {
          onClick?.(event);

          if (hasSiteControls) {
            togglePlayback();
          }
        }}
        onPlay={syncState}
        onPause={syncState}
        onEnded={syncState}
        onVolumeChange={syncState}
        onLoadedMetadata={syncState}
        onLoadedData={(event) => {
          const video = event.currentTarget;
          const pendingSeekSeconds = pendingSeekSecondsRef.current;

          frameLoadStateRef.current = "loaded";
          pendingSeekSecondsRef.current = null;

          if (scrubRef.current) {
            seekToScrubTarget(video, scrubRef.current);
          } else if (pendingSeekSeconds !== null) {
            video.currentTime = pendingSeekSeconds;
          }

          syncState();
        }}
        onSuspend={(event) => {
          const video = event.currentTarget;

          if (
            pendingSeekSecondsRef.current !== null &&
            frameLoadStateRef.current === "unloaded" &&
            video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
          ) {
            frameLoadStateRef.current = "loading";
            video.load();
          }
        }}
        onEmptied={() => {
          if (frameLoadStateRef.current === "loaded") {
            frameLoadStateRef.current = "unloaded";
            setHasVideoFrame(false);
          }
        }}
        onError={() => {
          if (frameLoadStateRef.current === "loading") {
            frameLoadStateRef.current = "unloaded";
          }

          pendingSeekSecondsRef.current = null;
          syncState();
        }}
        onDurationChange={syncState}
        onTimeUpdate={syncState}
        onSeeked={(event) => {
          const video = event.currentTarget;

          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            setHasVideoFrame(true);
          }

          if (scrubRef.current) {
            seekToScrubTarget(video, scrubRef.current);
          }
        }}
      />
      {isPosterOverlayVisible && (
        <img className={styles.poster} src={poster} alt="" aria-hidden="true" data-feed-omit />
      )}
      <div className={styles.controls} role="group" aria-label="Playback controls" data-feed-omit>
        <IconButton
          variant="strip"
          label={isPaused ? "Play" : "Pause"}
          disabled={!hasSiteControls}
          className={cx(styles.control, styles.playPauseControl)}
          onClick={togglePlayback}
        >
          {isPaused ? <PlayVideoIcon /> : <PauseVideoIcon />}
        </IconButton>
        <div
          ref={mergeRefs(trackRef, trackDragRef)}
          className={styles.track}
          role="slider"
          tabIndex={hasSiteControls ? 0 : -1}
          aria-label="Seek"
          aria-disabled={!hasDuration || undefined}
          aria-valuemin={0}
          aria-valuemax={Math.floor(duration)}
          aria-valuenow={currentSecond}
          aria-valuetext={`${formatPlaybackTime(currentSecond)} of ${formatPlaybackTime(duration)}`}
          {...trackHandlers}
        >
          <div ref={thumbRef} className={styles.thumb} />
        </div>
        <IconButton
          variant="strip"
          label={isMuted ? "Unmute" : "Mute"}
          disabled={!hasSiteControls}
          className={cx(styles.control, styles.muteControl)}
          onClick={toggleMuted}
        >
          {isMuted ? <SoundOffVideoIcon /> : <SoundOnVideoIcon />}
        </IconButton>
        <IconButton
          variant="strip"
          label={isFullScreen ? "Exit full screen" : "Enter full screen"}
          disabled={!canToggleFullScreen}
          className={cx(styles.control, styles.fullScreenControl)}
          onClick={toggleFullScreen}
        >
          {isFullScreen ? <FullScreenExitVideoIcon /> : <FullScreenEnterVideoIcon />}
        </IconButton>
      </div>
    </div>
  );
}
