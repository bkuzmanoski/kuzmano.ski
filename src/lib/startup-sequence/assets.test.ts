import { afterEach, describe, expect, test, vi } from "vitest";

import { whenDisplayGlassLayerReady } from "./assets.ts";

describe("whenDisplayGlassLayerReady", () => {
  const SVG_URL = "http://localhost/glass-layer.svg";
  const PNG_URL = "blob:http://localhost/glass-layer.png";

  const drawImage = vi.fn();
  const revokeObjectURL = vi.fn();

  function stubBrowser({
    isFirefox = true,
    pngBlob = new Blob(),
  }: { isFirefox?: boolean; pngBlob?: Blob | null } = {}) {
    vi.spyOn(CSS, "supports").mockReturnValue(isFirefox);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as RenderingContext);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(pngBlob));
    vi.stubGlobal("devicePixelRatio", 2);
    URL.createObjectURL = vi.fn(() => PNG_URL);
    URL.revokeObjectURL = revokeObjectURL;
  }

  function glassLayerImage(decode: () => Promise<void> = () => Promise.resolve()) {
    const image = document.createElement("img");

    image.src = SVG_URL;
    image.style.width = "100.25px";
    image.style.height = "200.75px";
    image.decode = decode;

    return image;
  }

  afterEach(() => {
    drawImage.mockClear();
    revokeObjectURL.mockClear();
  });

  test("in Firefox, replaces the SVG with a PNG rendered at the device pixel size of the fractional layout box", async () => {
    stubBrowser();

    const image = glassLayerImage();

    await whenDisplayGlassLayerReady(image);

    expect(drawImage).toHaveBeenCalledExactlyOnceWith(image, 0, 0, 201, 402);
    expect(image.src).toBe(PNG_URL);
  });

  test("revokes the URL of the PNG once the image decodes it", async () => {
    stubBrowser();
    await whenDisplayGlassLayerReady(glassLayerImage());

    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(PNG_URL);
  });

  test("keeps the SVG in a browser other than Firefox", async () => {
    stubBrowser({ isFirefox: false });

    const image = glassLayerImage();

    await whenDisplayGlassLayerReady(image);

    expect(drawImage).not.toHaveBeenCalled();
    expect(image.src).toBe(SVG_URL);
  });

  test("keeps the SVG when the SVG does not decode", async () => {
    stubBrowser();

    const image = glassLayerImage(() => Promise.reject(new Error("Decoding failed.")));

    await whenDisplayGlassLayerReady(image);

    expect(drawImage).not.toHaveBeenCalled();
    expect(image.src).toBe(SVG_URL);
  });

  test("keeps the SVG when the canvas does not produce a PNG", async () => {
    stubBrowser({ pngBlob: null });

    const image = glassLayerImage();

    await whenDisplayGlassLayerReady(image);

    expect(image.src).toBe(SVG_URL);
  });
});
