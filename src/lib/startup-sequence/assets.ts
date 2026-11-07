import { needsAudioPriming } from "../audio/context.ts";
import { loadKeySounds } from "../audio/sounds.ts";

export async function whenFontReady(): Promise<void> {
  const fontSet = (document as Partial<Document>).fonts;

  if (!fontSet) {
    return;
  }

  const promptFont = getComputedStyle(document.documentElement).getPropertyValue("--font-chrome").trim();

  try {
    if (promptFont) {
      await fontSet.load(promptFont);
    }

    await fontSet.ready;
  } catch {
    // Ignored.
  }
}

export const whenKeySoundsReady = (): Promise<unknown> => (needsAudioPriming() ? loadKeySounds() : Promise.resolve());

export function whenIllustrationReady(...images: Array<HTMLImageElement | null>): Promise<unknown> {
  return Promise.all(
    images.map((image) => (image?.decode ? image.decode().catch(() => undefined) : Promise.resolve())),
  );
}

/**
 * In Firefox, rasterizes the display glass layer's SVG as a device-pixel-sized PNG so stage zooming resamples a bitmap.
 * This avoids Firefox rerasterizing the filtered SVG on the main thread during scale changes which can freeze zooming
 * for roughly 300ms on large displays or briefly show a stale transform.
 *
 * If a step fails the original SVG remains in place.
 */
export async function whenDisplayGlassLayerReady(image: HTMLImageElement | null): Promise<void> {
  if (!image || !CSS.supports("-moz-appearance: none")) {
    return;
  }

  try {
    await image.decode();

    // Reads the computed size because `clientWidth` rounds to a whole CSS pixel, and a browser that resamples the PNG
    // to fit its layout box softens the grain.
    const { width, height } = getComputedStyle(image);
    const canvas = document.createElement("canvas");

    canvas.width = Math.round(parseFloat(width) * window.devicePixelRatio);
    canvas.height = Math.round(parseFloat(height) * window.devicePixelRatio);

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));

    if (!pngBlob) {
      return;
    }

    const pngUrl = URL.createObjectURL(pngBlob);

    image.src = pngUrl;
    await image.decode().finally(() => URL.revokeObjectURL(pngUrl));
  } catch {
    // Ignored.
  }
}
