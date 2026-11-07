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
