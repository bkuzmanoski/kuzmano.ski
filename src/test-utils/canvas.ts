import { vi } from "vitest";

/** Stubs `getContext` to return a 2D context that records `clearRect` and `drawImage` and returns the context. */
export function stubCanvasContext() {
  const context = {
    clearRect: vi.fn<CanvasRenderingContext2D["clearRect"]>(),
    drawImage: vi.fn<CanvasRenderingContext2D["drawImage"]>(),
    imageSmoothingEnabled: true,
  };

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);

  return context;
}

/**
 * Stubs every image to report the given load outcome. A browser marks an image `complete` whether it loaded or failed,
 * and reports a `naturalWidth` of `0` when it failed.
 */
export function stubImageLoad(outcome: "loaded" | "failed") {
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(outcome === "loaded" ? 1 : 0);
}
