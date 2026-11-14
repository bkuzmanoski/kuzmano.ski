export interface FrameScheduler {
  schedule: () => void;
  stop: () => void;
}

/** Coalesces requests to run `callback` into at most one run per animation frame. */
export function createFrameScheduler(callback: () => void): FrameScheduler {
  let frameId: number | null = null;
  let isStopped = false;

  return {
    schedule() {
      if (isStopped || frameId !== null) {
        return;
      }

      frameId = requestAnimationFrame(() => {
        frameId = null;
        callback();
      });
    },
    stop() {
      isStopped = true;

      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    },
  };
}

/** Invokes `onFrame` on each animation frame until the returned function stops the loop. */
export function loopAnimationFrames(onFrame: (now: DOMHighResTimeStamp) => void): () => void {
  let isStopped = false;
  let frameId = requestAnimationFrame(function run(now) {
    onFrame(now);

    // Schedule the next frame only after `onFrame` returns, so it can stop the loop.
    if (!isStopped) {
      frameId = requestAnimationFrame(run);
    }
  });

  return () => {
    isStopped = true;
    cancelAnimationFrame(frameId);
  };
}
