import { useEffect, useLayoutEffect, useRef, useState } from "react";

import FullScreenEnterIcon from "#/assets/images/video-full-screen-enter.svg?react";
import FullScreenExitIcon from "#/assets/images/video-full-screen-exit.svg?react";
import PauseIcon from "#/assets/images/video-pause.svg?react";
import PlayIcon from "#/assets/images/video-play.svg?react";
import SoundOffIcon from "#/assets/images/video-sound-off.svg?react";
import SoundOnIcon from "#/assets/images/video-sound-on.svg?react";
import { playClick } from "#/lib/audio/sounds.ts";
import { usePressSound } from "#/lib/audio/use-press-sound.ts";
import { cx } from "#/lib/class-names.ts";
import { formatPlaybackTime } from "#/lib/datetime.ts";
import { useClientValue, useIsHydrated } from "#/lib/hooks/use-client-value.ts";
import { usePointerDrag } from "#/lib/hooks/use-pointer-drag.ts";
import { clamp } from "#/lib/math.ts";
import { mergeRefs } from "#/lib/merge-refs.ts";

import styles from "./video.module.css";

import type { ComponentProps, KeyboardEvent } from "react";

const SEEK_STEP_S = 5;

interface WebKitVideoElement extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void; // Safari on iPhone can't make an arbitrary element full screen, only a `<video>` through its native player.
}

const canEnterFullScreen = () =>
  Boolean(document.fullscreenEnabled) || "webkitEnterFullscreen" in HTMLVideoElement.prototype;

export function Video({ controls, ...props }: ComponentProps<"video">) {
  return controls ? <ControlledVideo {...props} /> : <video {...props} />;
}

function ControlledVideo({
  className,
  "data-content-wide": contentWide,
  "data-content-space": contentSpace,
  onClick,
  onPointerDown,
  ref,
  ...props
}: Omit<ComponentProps<"video">, "controls"> & {
  "data-content-wide"?: boolean | string;
  "data-content-space"?: string;
}) {
  const [isPaused, setIsPaused] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [currentSecond, setCurrentSecond] = useState(0);
  const [duration, setDuration] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  const hasSiteControls = useIsHydrated();
  const canToggleFullScreen = useClientValue(false, canEnterFullScreen);
  const pressSoundHandlers = usePressSound();

  const hasDuration = duration > 0;

  const syncPosition = (video: HTMLVideoElement) => {
    const progress = Number.isFinite(video.duration) && video.duration > 0 ? video.currentTime / video.duration : 0;

    trackRef.current?.style.setProperty("--progress", String(clamp(progress, 0, 1)));
    setCurrentSecond(Math.floor(video.currentTime));
  };

  const syncState = () => {
    const video = videoRef.current;

    if (video) {
      setIsPaused(video.paused);
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

    let frame = 0;

    const tick = () => {
      if (videoRef.current) {
        syncPosition(videoRef.current);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
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

  function seekToPointer(clientX: number, trackLeft: number) {
    const trackWidth = trackRef.current?.clientWidth ?? 0;
    const thumbWidth = thumbRef.current?.offsetWidth ?? 0;
    const travel = trackWidth - thumbWidth;

    if (travel > 0) {
      seekTo(clamp((clientX - trackLeft - thumbWidth / 2) / travel, 0, 1) * duration);
    }
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

      playClick();
      trackRef.current?.focus({ preventScroll: true });
      seekToPointer(origin.x, origin.trackLeft);

      return origin;
    },
    onDragMove: ({ dx }, origin) => seekToPointer(origin.x + dx, origin.trackLeft),
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
      playClick();
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
      data-content-wide={contentWide}
      data-content-space={contentSpace}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <video
        {...props}
        ref={mergeRefs(ref, videoRef)}
        controls={!hasSiteControls}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          containerRef.current?.focus({ preventScroll: true });
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
      />
      <div className={styles.controls} role="group" aria-label="Playback controls" data-feed-omit>
        <button
          type="button"
          className={cx(styles.button, styles.playPauseButton)}
          disabled={!hasSiteControls}
          aria-label={isPaused ? "Play" : "Pause"}
          {...pressSoundHandlers}
          onClick={(event) => {
            pressSoundHandlers.onClick(event);
            togglePlayback();
          }}
        >
          {isPaused ? <PlayIcon className={styles.controlIcon} /> : <PauseIcon className={styles.controlIcon} />}
        </button>
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
        <button
          type="button"
          className={cx(styles.button, styles.muteButton)}
          disabled={!hasSiteControls}
          aria-label={isMuted ? "Unmute" : "Mute"}
          {...pressSoundHandlers}
          onClick={(event) => {
            pressSoundHandlers.onClick(event);
            toggleMuted();
          }}
        >
          {isMuted ? <SoundOffIcon className={styles.controlIcon} /> : <SoundOnIcon className={styles.controlIcon} />}
        </button>
        <button
          type="button"
          className={cx(styles.button, styles.fullScreenButton)}
          disabled={!canToggleFullScreen}
          aria-label={isFullScreen ? "Exit full screen" : "Enter full screen"}
          {...pressSoundHandlers}
          onClick={(event) => {
            pressSoundHandlers.onClick(event);
            toggleFullScreen();
          }}
        >
          {isFullScreen ? (
            <FullScreenExitIcon className={styles.controlIcon} />
          ) : (
            <FullScreenEnterIcon className={styles.controlIcon} />
          )}
        </button>
      </div>
    </div>
  );
}
