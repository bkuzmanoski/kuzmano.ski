import { useEffect, useLayoutEffect, useRef, useState } from "react";

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
import { clamp } from "#/lib/math.ts";
import { mergeRefs } from "#/lib/merge-refs.ts";
import { usePointerDrag } from "#/lib/press/use-pointer-drag.ts";

import styles from "./video.module.css";

import type { ComponentProps, KeyboardEvent } from "react";

const SEEK_STEP_S = 5;

interface WebKitVideoElement extends HTMLVideoElement {
  /** Safari on iPhone supports fullscreen only for `<video>` elements via its native player. */
  webkitEnterFullscreen?: () => void;
}

/** State tracked while the user drags the seek slider. */
interface Scrub {
  /** Whether playback was active when dragging began, so it can resume when dragging ends. */
  wasPlaying: boolean;
  /** The playback time corresponding to the pointer position. */
  targetSeconds: number;
  /** The latest requested seek time, or `null` until the first seek is requested. */
  requestedSeconds: number | null;
}

const LAYOUT_ATTRIBUTE_PREFIX = "data-content-";

type LayoutAttributes = Record<`${typeof LAYOUT_ATTRIBUTE_PREFIX}${string}`, unknown>;
type ControlledVideoProps = Omit<ComponentProps<"video">, "controls"> & Partial<LayoutAttributes>;

const canEnterFullScreen = () =>
  Boolean(document.fullscreenEnabled) || "webkitEnterFullscreen" in HTMLVideoElement.prototype;
const canFastSeek = () => "fastSeek" in HTMLMediaElement.prototype;

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

export function Video({ controls, ...props }: ComponentProps<"video">) {
  return controls ? <ControlledVideo {...props} /> : <video {...props} />;
}

function ControlledVideo({ className, style, onClick, onPointerDown, ref, ...props }: ControlledVideoProps) {
  const { layoutAttributes, videoProps } = partitionLayoutAttributes(props);
  const [isPaused, setIsPaused] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [currentSecond, setCurrentSecond] = useState(0);
  const [duration, setDuration] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<Scrub | null>(null);

  const hasSiteControls = useIsHydrated();
  const canToggleFullScreen = useClientValue(false, canEnterFullScreen);

  const hasDuration = duration > 0;

  const syncPosition = (video: HTMLVideoElement) => {
    const seconds = scrubRef.current?.targetSeconds ?? video.currentTime;
    const progress = Number.isFinite(video.duration) && video.duration > 0 ? seconds / video.duration : 0;

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
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      syncPosition(video);
    }
  };

  // Media events that fired before hydration were missed, so the state is read from the element before it paints.
  useLayoutEffect(syncState, []);

  // `timeupdate` fires only a few times a second, which moves the thumb in visible steps during playback.
  useEffect(() => {
    if (isPaused) {
      return;
    }

    return loopAnimationFrames(() => {
      if (videoRef.current) {
        syncPosition(videoRef.current);
      }
    });
  }, [isPaused]);

  useEffect(() => {
    const syncFullScreen = () => setIsFullScreen(document.fullscreenElement === containerRef.current);

    document.addEventListener("fullscreenchange", syncFullScreen);

    return () => document.removeEventListener("fullscreenchange", syncFullScreen);
  }, []);

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
      video.currentTime = clamp(seconds, 0, duration);
      syncPosition(video);
    }
  }

  function startScrub() {
    const video = videoRef.current;

    if (video) {
      scrubRef.current = { wasPlaying: !video.paused, targetSeconds: video.currentTime, requestedSeconds: null };
      video.pause();
    }
  }

  /**
   * Seeks to the latest scrub target after the current seek completes. `onSeeked` invokes this again if the pointer
   * moved while seeking.
   *
   * Updating `currentTime` during an active seek cancels it, so seeking on every pointer move can prevent frames from
   * rendering. When available, `fastSeek` jumps to a decodable keyframe.
   */
  function seekToScrubTarget(video: HTMLVideoElement, scrub: Scrub) {
    if (video.seeking || scrub.requestedSeconds === scrub.targetSeconds) {
      return;
    }

    scrub.requestedSeconds = scrub.targetSeconds;

    if (canFastSeek()) {
      video.fastSeek(scrub.targetSeconds);
    } else {
      video.currentTime = scrub.targetSeconds;
    }
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

  function endScrub() {
    const video = videoRef.current;
    const scrub = scrubRef.current;

    scrubRef.current = null;

    if (!video || !scrub) {
      return;
    }

    // Apply the exact target because `fastSeek` may land on a keyframe and `seekToScrubTarget` can miss the latest
    // target.
    video.currentTime = scrub.targetSeconds;

    // Playing a video from its end restarts it from the beginning.
    if (scrub.wasPlaying && scrub.targetSeconds < duration) {
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
    } else {
      video?.webkitEnterFullscreen?.();
    }
  }

  const trackHandlers = usePointerDrag({
    preventDefault: true,
    canStart: () => hasDuration,
    start: (event) => {
      const origin = { x: event.clientX, trackLeft: event.currentTarget.getBoundingClientRect().left };

      playClickSound();
      trackRef.current?.focus({ preventScroll: true });
      startScrub();
      scrubToPointer(origin.x, origin.trackLeft);

      return origin;
    },
    onDragMove: ({ dx }, origin) => scrubToPointer(origin.x + dx, origin.trackLeft),
    onEnd: endScrub,
  });

  function onKeyDown(event: KeyboardEvent) {
    if (!hasSiteControls || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const currentTime = videoRef.current?.currentTime ?? 0;
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
        onDurationChange={syncState}
        onTimeUpdate={syncState}
        onSeeked={(event) => {
          if (scrubRef.current) {
            seekToScrubTarget(event.currentTarget, scrubRef.current);
          }
        }}
      />
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
          ref={trackRef}
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
