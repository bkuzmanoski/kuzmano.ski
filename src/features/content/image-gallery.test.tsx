import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import zoomRectStyles from "#/features/window-manager/zoom-rect.module.css";
import { ZOOM_RECT_DURATION_MS } from "#/features/window-manager/zoom-rect.tsx";
import { playClickSound, playHoverSound, playKeyDownSound, playKeyUpSound } from "#/lib/audio/sounds.ts";
import * as imageGalleryFixture from "#/test-utils/fixtures/image-gallery.mdx";
import { advanceTimersBy } from "#/test-utils/timers.ts";

import styles from "./image-gallery.module.css";
import { ImageGallery, SWIPE_DISTANCE_PX } from "./image-gallery.tsx";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal),
);
vi.mock("#/lib/hooks/use-prefers-reduced-motion.ts", () => ({
  getPrefersReducedMotion: () => prefersReducedMotion.matches,
}));

const prefersReducedMotion = { matches: true };

beforeEach(() => {
  prefersReducedMotion.matches = true;
  vi.mocked(playClickSound).mockClear();
  vi.mocked(playHoverSound).mockClear();
  vi.mocked(playKeyDownSound).mockClear();
  vi.mocked(playKeyUpSound).mockClear();
});

afterEach(() => {
  // A swipe swallows the click of its press until the next press starts (see `swallowNextPress`),
  // so a press here keeps it from swallowing a click in the next test.
  fireEvent.pointerDown(document.body);
});

const SWIPE_START_POINT = { x: 200, y: 100 };
const TOUCH_PRESS = { pointerType: "touch", button: 0 };

const renderGallery = () =>
  render(
    <ImageGallery caption="A caption.">
      <img src="/first.png" alt="First image" />
      <img src="/second.png" alt="Second image" />
      <img src="/third.png" alt="Third image" />
    </ImageGallery>,
  );
const renderGalleryWithPreviewImageArea = () => {
  const previewImageArea = renderGallery().container.querySelector<HTMLElement>(`.${styles.previewImage}`)!;

  vi.spyOn(previewImageArea, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 998, 748));

  return previewImageArea;
};
const shownSlide = () => screen.getByRole("tabpanel");
const shownImageName = () => within(shownSlide()).getByRole("img").getAttribute("alt");
const stage = () => shownSlide().parentElement!;
const thumbnail = (name: string) => screen.getByRole("tab", { name });
const altOf = (element: HTMLElement) => element.querySelector("img")?.getAttribute("alt") ?? null;
const galleryControls = () => screen.getByRole("tablist").closest<HTMLElement>("[data-feed-omit]")!;
const galleryButton = (name: string) => within(galleryControls()).getByRole("button", { name });
const preview = () => document.querySelector("dialog")!; // A closed `<dialog>` does not have the `dialog` role in the accessibility tree.
const previewButton = (name: string) => within(preview()).getByRole("button", { name, hidden: true });
const previewImageName = () => within(preview()).getByRole("img", { hidden: true }).getAttribute("alt");
const previewImageElement = () => within(preview()).getByRole("img", { hidden: true });
const loadWithNaturalSize = (image: HTMLElement, naturalWidth: number, naturalHeight: number) =>
  Object.defineProperties(image, { naturalWidth: { value: naturalWidth }, naturalHeight: { value: naturalHeight } });
const sizeOf = (previewImageArea: HTMLElement) => [
  previewImageArea.style.getPropertyValue("--image-gallery-preview-image-width"),
  previewImageArea.style.getPropertyValue("--image-gallery-preview-image-height"),
];
const offsetOf = (previewImageArea: HTMLElement) => [
  previewImageArea.style.getPropertyValue("--image-gallery-preview-image-offset-x"),
  previewImageArea.style.getPropertyValue("--image-gallery-preview-image-offset-y"),
];

function swipeAcross(element: Element, { dx, dy = 0 }: { dx: number; dy?: number }) {
  fireEvent.pointerDown(element, {
    button: 0,
    pointerId: 1,
    pointerType: "touch",
    clientX: SWIPE_START_POINT.x,
    clientY: SWIPE_START_POINT.y,
  });
  fireEvent.pointerMove(window, {
    buttons: 1,
    pointerId: 1,
    clientX: SWIPE_START_POINT.x + dx,
    clientY: SWIPE_START_POINT.y + dy,
  });
  fireEvent.pointerUp(window, { pointerId: 1 });
}

test("the gallery renders a slide for each image, and shows only the first", () => {
  renderGallery();

  expect(screen.getAllByRole("tabpanel", { hidden: true }).map((slide) => slide.getAttribute("aria-label"))).toEqual([
    "1 of 3",
    "2 of 3",
    "3 of 3",
  ]);
  expect(shownSlide().getAttribute("aria-label")).toBe("1 of 3");
  expect(shownImageName()).toBe("First image");
});

test("the gallery renders a thumbnail tab for each image, named by the image's alternative text, with the first selected", () => {
  renderGallery();

  expect(screen.getAllByRole("tab").map(altOf)).toEqual(["First image", "Second image", "Third image"]);
  expect(thumbnail("First image").getAttribute("aria-selected")).toBe("true");
  expect(thumbnail("First image").getAttribute("aria-controls")).toBe(shownSlide().id);
});

test("the gallery renders the images authored inside it in Markdown, as `<img>` elements, and as `<picture>` elements", () => {
  render(<imageGalleryFixture.default components={{ ImageGallery }} />);

  expect(screen.getAllByRole("tab").map(altOf)).toEqual(["First image", "Second image", "Third image", "Fourth image"]);
  expect(
    screen.getAllByRole("tabpanel", { hidden: true }).at(-1)!.querySelector("picture > source")?.getAttribute("srcset"),
  ).toBe("https://example.com/fourth.avif");
});

test("the gallery throws for a child other than an image", () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  expect(() =>
    render(
      <ImageGallery>
        <img src="/first.png" alt="First image" />
        <span>Text</span>
      </ImageGallery>,
    ),
  ).toThrow("An `ImageGallery` contains only images, authored in Markdown or as `<img>` or `<picture>` elements.");
});

test("the gallery throws when it does not contain an image", () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  expect(() => render(<ImageGallery>{"\n"}</ImageGallery>)).toThrow("An `ImageGallery` contains at least one image.");
});

test("the gallery renders its `caption` prop as the `<figcaption>`, which names it", () => {
  renderGallery();

  const gallery = screen.getByRole("figure", { name: "A caption." });

  expect(gallery.querySelector("figcaption")?.textContent).toBe("A caption.");
  expect(gallery.getAttribute("aria-roledescription")).toBe("carousel");
});

test("the gallery is named `Image gallery` without a `caption` prop", () => {
  render(
    <ImageGallery>
      <img src="/first.png" alt="First image" />
    </ImageGallery>,
  );
  expect(screen.getByRole("figure", { name: "Image gallery" }).querySelector("figcaption")).toBeNull();
});

test("the gallery renders its other props on the `<figure>`, and marks it with the `data-image-gallery` attribute", () => {
  render(
    <ImageGallery style={{ color: "red" }} data-content-span="wide">
      <img src="/first.png" alt="First image" />
    </ImageGallery>,
  );

  const gallery = screen.getByRole("figure");

  expect(gallery.style.color).toBe("red");
  expect(gallery.getAttribute("data-content-span")).toBe("wide");
  expect(gallery.hasAttribute("data-image-gallery")).toBe(true);
});

test("pressing the `Next image` button shows the next image and selects its thumbnail", () => {
  renderGallery();

  fireEvent.click(galleryButton("Next image"));

  expect(shownImageName()).toBe("Second image");
  expect(thumbnail("Second image").getAttribute("aria-selected")).toBe("true");
  expect(thumbnail("First image").getAttribute("aria-selected")).toBe("false");
});

test("the gallery marks the `Previous image` button with the `aria-disabled` attribute on the first image, and the `Next image` button on the last, and pressing either there leaves the shown image unchanged", () => {
  renderGallery();

  expect(galleryButton("Previous image").getAttribute("aria-disabled")).toBe("true");
  expect(galleryButton("Next image").hasAttribute("aria-disabled")).toBe(false);

  fireEvent.click(galleryButton("Previous image"));

  expect(shownImageName()).toBe("First image");

  fireEvent.click(thumbnail("Third image"));

  expect(galleryButton("Next image").getAttribute("aria-disabled")).toBe("true");
  expect(galleryButton("Previous image").hasAttribute("aria-disabled")).toBe(false);

  fireEvent.click(galleryButton("Next image"));

  expect(shownImageName()).toBe("Third image");
});

test("a gallery of one image disables the `Previous image` and `Next image` buttons", () => {
  render(
    <ImageGallery>
      <img src="/first.png" alt="First image" />
    </ImageGallery>,
  );

  expect(galleryButton("Previous image")).toHaveProperty("disabled", true);
  expect(galleryButton("Next image")).toHaveProperty("disabled", true);
  expect(galleryButton("Preview image")).toHaveProperty("disabled", false);
});

test("pressing a thumbnail shows its image", () => {
  renderGallery();

  fireEvent.click(thumbnail("Third image"));

  expect(shownImageName()).toBe("Third image");
});

test("a touch on a thumbnail plays the click sound when its `click` event selects the image", () => {
  renderGallery();

  fireEvent.pointerDown(thumbnail("Third image"), TOUCH_PRESS);
  fireEvent.pointerUp(thumbnail("Third image"), TOUCH_PRESS);

  expect(playClickSound).not.toHaveBeenCalled();

  fireEvent.click(thumbnail("Third image"), { detail: 1 });

  expect(playClickSound).toHaveBeenCalledOnce();
  expect(shownImageName()).toBe("Third image");
});

test.each([
  ["Right", "ArrowRight", "Third image"],
  ["Left", "ArrowLeft", "First image"],
])(
  "pressing the %s arrow key in the gallery shows the adjacent image and plays the hover sound",
  (_label, key, imageName) => {
    renderGallery();
    fireEvent.click(thumbnail("Second image"));
    fireEvent.keyDown(shownSlide(), { key });

    expect(shownImageName()).toBe(imageName);
    expect(playHoverSound).toHaveBeenCalledOnce();
  },
);

test("pressing the Left arrow key on the first image leaves it shown, without playing the hover sound", () => {
  renderGallery();

  fireEvent.keyDown(shownSlide(), { key: "ArrowLeft" });

  expect(shownImageName()).toBe("First image");
  expect(playHoverSound).not.toHaveBeenCalled();
});

test.each([
  ["a thumbnail", "it", () => thumbnail("Second image"), () => thumbnail("Second image")],
  ["the `Next image` button", "it", () => galleryButton("Next image"), () => galleryButton("Next image")],
  ["the row around the thumbnails", "the gallery", () => screen.getByRole("tablist"), () => screen.getByRole("figure")],
])(
  "a press on %s focuses %s, so the arrow keys then show the adjacent image",
  (_pressLabel, _focusLabel, pressTarget, focusTarget) => {
    renderGallery();

    fireEvent.pointerDown(pressTarget());

    expect(document.activeElement).toBe(focusTarget());

    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });

    expect(shownImageName()).toBe("Second image");
  },
);

test("pressing an arrow key on a thumbnail moves the focus to the thumbnail of the image it shows, which becomes the row's tab stop", () => {
  renderGallery();
  thumbnail("First image").focus();

  fireEvent.keyDown(thumbnail("First image"), { key: "ArrowRight" });

  expect(document.activeElement).toBe(thumbnail("Second image"));
  expect(thumbnail("Second image").tabIndex).toBe(0);
  expect(thumbnail("First image").tabIndex).toBe(-1);
});

test("pressing the Home and End keys on a thumbnail shows the first and last images, and focuses their thumbnails", () => {
  renderGallery();
  thumbnail("First image").focus();

  fireEvent.keyDown(thumbnail("First image"), { key: "End" });

  expect(shownImageName()).toBe("Third image");
  expect(document.activeElement).toBe(thumbnail("Third image"));

  fireEvent.keyDown(thumbnail("Third image"), { key: "Home" });

  expect(shownImageName()).toBe("First image");
  expect(document.activeElement).toBe(thumbnail("First image"));
});

test("swiping left across the shown image shows the next image, and swiping right shows the previous", () => {
  renderGallery();
  swipeAcross(stage(), { dx: -SWIPE_DISTANCE_PX });

  expect(shownImageName()).toBe("Second image");
  expect(playHoverSound).toHaveBeenCalledOnce();

  swipeAcross(stage(), { dx: SWIPE_DISTANCE_PX });

  expect(shownImageName()).toBe("First image");
});

test.each([
  ["shorter than the swipe distance", { dx: -(SWIPE_DISTANCE_PX - 1) }],
  ["that travels further vertically than horizontally", { dx: -SWIPE_DISTANCE_PX, dy: SWIPE_DISTANCE_PX + 1 }],
])("a touch drag %s leaves the shown image unchanged", (_label, travel) => {
  renderGallery();
  swipeAcross(stage(), travel);

  expect(shownImageName()).toBe("First image");
});

test("a swipe across the shown image does not open the preview or play the click sound", () => {
  renderGallery();
  swipeAcross(stage(), { dx: -SWIPE_DISTANCE_PX });
  fireEvent.click(stage());

  expect(preview().open).toBe(false);
  expect(playClickSound).not.toHaveBeenCalled();
});

test("an arrow key pressed with the Command key held leaves the shown image unchanged, and its default action is not prevented", () => {
  renderGallery();

  const isDefaultAllowed = fireEvent.keyDown(shownSlide(), { key: "ArrowRight", metaKey: true });

  expect(isDefaultAllowed).toBe(true);
  expect(shownImageName()).toBe("First image");
});

test("pressing the Space key on a thumbnail opens the preview, and pressing it in the preview closes it", () => {
  renderGallery();

  fireEvent.keyDown(thumbnail("First image"), { key: " " });

  expect(preview().open).toBe(true);
  expect(document.activeElement).toBe(preview());

  fireEvent.keyDown(preview(), { key: " " });

  expect(preview().open).toBe(false);
});

test("pressing the Space key on the shown slide opens the preview", () => {
  renderGallery();
  fireEvent.keyDown(shownSlide(), { key: " " });

  expect(preview().open).toBe(true);
});

test("pressing the Space key in the gallery plays the key down sound, and releasing it plays the key up sound", () => {
  renderGallery();
  fireEvent.keyDown(shownSlide(), { key: " ", code: "Space" });

  expect(playKeyDownSound).toHaveBeenCalledOnce();
  expect(playKeyUpSound).not.toHaveBeenCalled();

  fireEvent.keyUp(window, { key: " ", code: "Space" });

  expect(playKeyUpSound).toHaveBeenCalledOnce();
});

test("holding the Space key in the gallery opens the preview once, and plays the key down sound once", () => {
  renderGallery();
  fireEvent.keyDown(shownSlide(), { key: " ", code: "Space" });
  fireEvent.keyDown(preview(), { key: " ", code: "Space", repeat: true });

  expect(preview().open).toBe(true);
  expect(playKeyDownSound).toHaveBeenCalledOnce();
});

test("pressing the Space key on the `Next image` button leaves the preview closed, and its default action is not prevented", () => {
  renderGallery();

  const isDefaultAllowed = fireEvent.keyDown(galleryButton("Next image"), { key: " " });

  expect(isDefaultAllowed).toBe(true);
  expect(preview().open).toBe(false);
});

test("clicking the shown image opens the preview of that image, and focuses the preview", () => {
  renderGallery();
  fireEvent.click(thumbnail("Second image"));
  fireEvent.click(within(shownSlide()).getByRole("img"));

  expect(preview().open).toBe(true);
  expect(previewImageName()).toBe("Second image");
  expect(document.activeElement).toBe(preview());
});

test("pressing the `Preview image` button opens the preview of the shown image, without the thumbnails", () => {
  renderGallery();
  fireEvent.click(galleryButton("Preview image"));

  expect(screen.getByRole("dialog", { name: "Image preview" })).toBe(preview());
  expect(preview().open).toBe(true);
  expect(previewImageName()).toBe("First image");
  expect(within(preview()).getByRole("group", { name: "1 of 3", hidden: true })).toBeDefined();
  expect(within(preview()).queryByRole("tab", { hidden: true })).toBeNull();
});

test("pressing the arrow keys in the preview shows the adjacent image in the preview and in the gallery", () => {
  renderGallery();
  fireEvent.click(galleryButton("Preview image"));
  fireEvent.keyDown(preview(), { key: "ArrowRight" });

  expect(previewImageName()).toBe("Second image");
  expect(shownImageName()).toBe("Second image");

  fireEvent.keyDown(preview(), { key: "ArrowLeft" });

  expect(previewImageName()).toBe("First image");
});

test("pressing the `Previous image` and `Next image` buttons in the preview shows the adjacent image, and the preview shows its position", () => {
  renderGallery();
  fireEvent.click(galleryButton("Preview image"));
  fireEvent.click(previewButton("Next image"));

  expect(previewImageName()).toBe("Second image");
  expect(within(preview()).getByText("2 of 3").getAttribute("aria-hidden")).toBe("true");

  fireEvent.click(previewButton("Previous image"));

  expect(previewImageName()).toBe("First image");
});

test("swiping left across the image in the preview shows the next image", () => {
  renderGallery();
  fireEvent.click(galleryButton("Preview image"));
  swipeAcross(within(preview()).getByRole("img", { hidden: true }), { dx: -SWIPE_DISTANCE_PX });

  expect(previewImageName()).toBe("Second image");
});

test("pressing the `Close preview` button closes the preview", () => {
  renderGallery();
  fireEvent.click(galleryButton("Preview image"));
  fireEvent.click(previewButton("Close preview"));

  expect(preview().open).toBe(false);
});

test("a press that starts and ends outside the preview's frame closes the preview", () => {
  renderGallery();
  fireEvent.click(galleryButton("Preview image"));
  fireEvent.pointerDown(preview());
  fireEvent.click(preview());

  expect(preview().open).toBe(false);
});

test("a press that starts on the image in the preview and ends outside the frame leaves the preview open", () => {
  renderGallery();
  fireEvent.click(galleryButton("Preview image"));
  fireEvent.pointerDown(within(preview()).getByRole("img", { hidden: true }));
  fireEvent.click(preview());

  expect(preview().open).toBe(true);
});

test("closing the preview opened from a thumbnail moves the focus to the thumbnail of the image it shows", () => {
  renderGallery();
  thumbnail("First image").focus();
  fireEvent.keyDown(thumbnail("First image"), { key: " " });
  fireEvent.keyDown(preview(), { key: "ArrowRight" });

  act(() => {
    thumbnail("First image").focus();
  });

  fireEvent.click(previewButton("Close preview"));

  expect(document.activeElement).toBe(thumbnail("Second image"));
});

test("pressing the Escape key in the preview closes it", () => {
  renderGallery();
  fireEvent.click(galleryButton("Preview image"));

  const isDefaultAllowed = fireEvent(preview(), new Event("cancel", { cancelable: true })); // The Escape key fires `cancel` on an open dialog.

  expect(isDefaultAllowed).toBe(false);
  expect(preview().open).toBe(false);
});

describe("the size of the image in the preview", () => {
  test("is the image's natural size when it fits the preview's image area", () => {
    const previewImageArea = renderGalleryWithPreviewImageArea();

    loadWithNaturalSize(previewImageElement(), 600, 400);
    fireEvent.click(galleryButton("Preview image"));

    expect(sizeOf(previewImageArea)).toEqual(["600px", "400px"]);
  });

  test.each([
    ["wider", 2000, 1000, ["998px", "499px"]],
    ["taller", 1000, 1500, ["498px", "748px"]],
  ])(
    "is scaled down to whole pixels for an image %s than the preview's image area",
    (_label, naturalWidth, naturalHeight, size) => {
      const previewImageArea = renderGalleryWithPreviewImageArea();

      loadWithNaturalSize(previewImageElement(), naturalWidth, naturalHeight);
      fireEvent.click(galleryButton("Preview image"));

      expect(sizeOf(previewImageArea)).toEqual(size);
    },
  );

  test("is set once the image loads, and again when the window is resized", () => {
    const previewImageArea = renderGalleryWithPreviewImageArea();

    fireEvent.click(galleryButton("Preview image"));

    expect(sizeOf(previewImageArea)).toEqual(["", ""]);

    loadWithNaturalSize(previewImageElement(), 2000, 1000);
    fireEvent.load(previewImageElement());

    expect(sizeOf(previewImageArea)).toEqual(["998px", "499px"]);

    vi.spyOn(previewImageArea, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 500, 748));
    fireEvent(window, new Event("resize"));

    expect(sizeOf(previewImageArea)).toEqual(["500px", "250px"]);
  });

  test("is unset for an image the preview moves to before it loads", () => {
    const previewImageArea = renderGalleryWithPreviewImageArea();

    loadWithNaturalSize(previewImageElement(), 600, 400);
    fireEvent.click(galleryButton("Preview image"));

    expect(sizeOf(previewImageArea)).toEqual(["600px", "400px"]);

    fireEvent.click(previewButton("Next image"));

    expect(sizeOf(previewImageArea)).toEqual(["", ""]);
  });
});

describe("zooming the image in the preview", () => {
  const SCROLL_TO_DOUBLE_PX = Math.log(2) / 0.002; // The distance scrolled that zooms the image in to twice its fitted size.

  // Opens a 1200x800 image preview, fitted to 600x400 in an image area centered at (300, 200).
  // At its natural size, it overflows the image area by 300 pixels on each horizontal side and 200 vertically.
  const openPreviewOfFittedImage = () => {
    const previewImageArea = renderGallery().container.querySelector<HTMLElement>(`.${styles.previewImage}`)!;

    vi.spyOn(previewImageArea, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 600, 400));
    loadWithNaturalSize(previewImageElement(), 1200, 800);
    fireEvent.click(galleryButton("Preview image"));

    return previewImageArea;
  };

  test("scrolling down over the image zooms it in about the pointer up to its natural size, and scrolling up zooms it out no further than its fitted size", () => {
    const previewImageArea = openPreviewOfFittedImage();

    fireEvent.wheel(previewImageArea, { deltaY: SCROLL_TO_DOUBLE_PX / 2, clientX: 400, clientY: 200 });

    expect(sizeOf(previewImageArea)).toEqual(["849px", "566px"]);
    expect(offsetOf(previewImageArea)).toEqual(["-41px", "0px"]);

    fireEvent.wheel(previewImageArea, { deltaY: 10 * SCROLL_TO_DOUBLE_PX, clientX: 400, clientY: 200 });

    expect(sizeOf(previewImageArea)).toEqual(["1200px", "800px"]);
    expect(offsetOf(previewImageArea)).toEqual(["-100px", "0px"]);

    fireEvent.wheel(previewImageArea, { deltaY: -10 * SCROLL_TO_DOUBLE_PX, clientX: 400, clientY: 200 });

    expect(sizeOf(previewImageArea)).toEqual(["600px", "400px"]);
    expect(offsetOf(previewImageArea)).toEqual(["0px", "0px"]);
  });

  test("a trackpad pinch apart zooms the image in", () => {
    const previewImageArea = openPreviewOfFittedImage();

    fireEvent.wheel(previewImageArea, { deltaY: -100, ctrlKey: true, clientX: 300, clientY: 200 });

    expect(sizeOf(previewImageArea)).toEqual(["1200px", "800px"]);
  });

  test("a pinch zooms the image in about the midpoint of the touches", () => {
    const previewImageArea = openPreviewOfFittedImage();

    fireEvent.pointerDown(previewImageArea, {
      button: 0,
      pointerId: 1,
      pointerType: "touch",
      clientX: 200,
      clientY: 200,
    });
    fireEvent.pointerDown(previewImageArea, {
      button: 0,
      pointerId: 2,
      pointerType: "touch",
      clientX: 400,
      clientY: 200,
    });
    fireEvent.pointerMove(previewImageArea, { pointerId: 2, pointerType: "touch", clientX: 600, clientY: 200 });

    expect(sizeOf(previewImageArea)).toEqual(["1200px", "800px"]);
    expect(offsetOf(previewImageArea)).toEqual(["100px", "0px"]);
  });

  test("dragging a zoomed image pans it no further than its edges", () => {
    const previewImageArea = openPreviewOfFittedImage();

    fireEvent.wheel(previewImageArea, { deltaY: SCROLL_TO_DOUBLE_PX, clientX: 300, clientY: 200 });
    fireEvent.pointerDown(previewImageArea, {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      clientX: 300,
      clientY: 200,
    });
    fireEvent.pointerMove(previewImageArea, { pointerId: 1, pointerType: "mouse", clientX: 350, clientY: 210 });

    expect(offsetOf(previewImageArea)).toEqual(["50px", "10px"]);

    fireEvent.pointerMove(previewImageArea, { pointerId: 1, pointerType: "mouse", clientX: 1000, clientY: 700 });

    expect(offsetOf(previewImageArea)).toEqual(["300px", "200px"]);
  });

  test("a touch dragged across a zoomed image pans it, rather than showing the next image", () => {
    const previewImageArea = openPreviewOfFittedImage();

    fireEvent.wheel(previewImageArea, { deltaY: SCROLL_TO_DOUBLE_PX, clientX: 300, clientY: 200 });
    fireEvent.pointerDown(previewImageArea, {
      button: 0,
      pointerId: 1,
      pointerType: "touch",
      clientX: 300,
      clientY: 200,
    });
    fireEvent.pointerMove(previewImageArea, {
      buttons: 1,
      pointerId: 1,
      pointerType: "touch",
      clientX: 200,
      clientY: 200,
    });
    fireEvent.pointerUp(previewImageArea, { pointerId: 1, pointerType: "touch" });

    expect(previewImageName()).toBe("First image");
    expect(offsetOf(previewImageArea)).toEqual(["-100px", "0px"]);
  });

  test("a touch dragged across the image after a pinch back to its fitted size leaves the same image shown", () => {
    const previewImageArea = openPreviewOfFittedImage();

    fireEvent.pointerDown(previewImageArea, {
      button: 0,
      pointerId: 1,
      pointerType: "touch",
      clientX: 400,
      clientY: 200,
    });
    fireEvent.pointerDown(previewImageArea, {
      button: 0,
      pointerId: 2,
      pointerType: "touch",
      clientX: 500,
      clientY: 200,
    });
    fireEvent.pointerMove(previewImageArea, {
      buttons: 1,
      pointerId: 2,
      pointerType: "touch",
      clientX: 450,
      clientY: 200,
    });
    fireEvent.pointerUp(previewImageArea, { pointerId: 1, pointerType: "touch" });
    fireEvent.pointerMove(previewImageArea, {
      buttons: 1,
      pointerId: 2,
      pointerType: "touch",
      clientX: 250,
      clientY: 200,
    });
    fireEvent.pointerUp(previewImageArea, { pointerId: 2, pointerType: "touch" });

    expect(sizeOf(previewImageArea)).toEqual(["600px", "400px"]);
    expect(previewImageName()).toBe("First image");
  });

  test("scrolling over an image fitted at its natural size leaves it at that size", () => {
    const previewImageArea = renderGalleryWithPreviewImageArea();

    loadWithNaturalSize(previewImageElement(), 600, 400);
    fireEvent.click(galleryButton("Preview image"));
    fireEvent.wheel(previewImageArea, { deltaY: SCROLL_TO_DOUBLE_PX, clientX: 499, clientY: 374 });

    expect(sizeOf(previewImageArea)).toEqual(["600px", "400px"]);
    expect(previewImageArea.hasAttribute("data-image-gallery-preview-zoomed")).toBe(false);
  });

  test("moving to another image fits it unzoomed once it loads", () => {
    const previewImageArea = openPreviewOfFittedImage();

    fireEvent.wheel(previewImageArea, { deltaY: SCROLL_TO_DOUBLE_PX, clientX: 400, clientY: 200 });
    fireEvent.click(previewButton("Next image"));
    loadWithNaturalSize(previewImageElement(), 1200, 800);
    fireEvent.load(previewImageElement());

    expect(sizeOf(previewImageArea)).toEqual(["600px", "400px"]);
    expect(offsetOf(previewImageArea)).toEqual(["0px", "0px"]);
  });
});

describe("when reduced motion is not preferred", () => {
  beforeEach(() => {
    prefersReducedMotion.matches = false;
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  // The stage is at (100, 200) and the preview's frame at (20, 40), so in the preview's coordinates
  // the stage is at (80, 160), and the frame fills the preview.
  const STAGE_IN_PREVIEW = { left: "80px", top: "160px", width: "300px", height: "200px" };
  const FRAME_IN_PREVIEW = { left: "0px", top: "0px", width: "800px", height: "600px" };

  const renderGalleryInFrames = () => {
    const rendered = renderGallery();
    const previewFrame = rendered.container.querySelector<HTMLElement>(`.${styles.previewFrame}`)!;

    vi.spyOn(stage(), "getBoundingClientRect").mockReturnValue(new DOMRect(100, 200, 300, 200));
    vi.spyOn(previewFrame, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 40, 800, 600));
  };
  const zoomRect = () => preview().querySelector<HTMLElement>(`.${zoomRectStyles.zoomRect}`);
  const boxOf = (element: HTMLElement | null) => {
    const { left, top, width, height } = element?.style ?? {};
    return { left, top, width, height };
  };
  const advanceTwoFrames = () =>
    act(() => {
      // `ZoomRect` starts growing two animation frames after it mounts.
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
    });

  test("opening the preview grows a zoom rect from the stage to the preview's frame, and sets the `data-image-gallery-zoom-rect` attribute of the preview to `in` until the zoom rect has finished", () => {
    renderGalleryInFrames();
    fireEvent.click(galleryButton("Preview image"));

    expect(boxOf(zoomRect())).toEqual(STAGE_IN_PREVIEW);
    expect(preview().getAttribute("data-image-gallery-zoom-rect")).toBe("in");

    advanceTwoFrames();

    expect(boxOf(zoomRect())).toEqual(FRAME_IN_PREVIEW);

    advanceTimersBy(ZOOM_RECT_DURATION_MS);

    expect(zoomRect()).toBeNull();
    expect(preview().hasAttribute("data-image-gallery-zoom-rect")).toBe(false);
  });

  test("closing the preview shrinks a zoom rect from the preview's frame to the stage, and closes the preview once the zoom rect has finished", () => {
    renderGalleryInFrames();
    fireEvent.click(galleryButton("Preview image"));
    advanceTimersBy(ZOOM_RECT_DURATION_MS);
    fireEvent.click(previewButton("Close preview"));

    expect(boxOf(zoomRect())).toEqual(FRAME_IN_PREVIEW);
    expect(preview().getAttribute("data-image-gallery-zoom-rect")).toBe("out");
    expect(preview().open).toBe(true);

    advanceTwoFrames();

    expect(boxOf(zoomRect())).toEqual(STAGE_IN_PREVIEW);

    advanceTimersBy(ZOOM_RECT_DURATION_MS);

    expect(preview().open).toBe(false);
    expect(preview().hasAttribute("data-image-gallery-zoom-rect")).toBe(false);
  });

  test("closing the preview while it zooms in zooms out at once", () => {
    renderGalleryInFrames();
    fireEvent.click(galleryButton("Preview image"));
    advanceTimersBy(ZOOM_RECT_DURATION_MS / 2);

    fireEvent.keyDown(preview(), { key: " " });

    expect(preview().getAttribute("data-image-gallery-zoom-rect")).toBe("out");

    advanceTimersBy(ZOOM_RECT_DURATION_MS);

    expect(preview().open).toBe(false);
  });
});

test("opening and closing the preview when reduced motion is preferred omits the zoom rect", () => {
  renderGallery();
  fireEvent.click(galleryButton("Preview image"));

  expect(preview().open).toBe(true);
  expect(preview().hasAttribute("data-image-gallery-zoom-rect")).toBe(false);
  expect(preview().querySelector(`.${zoomRectStyles.zoomRect}`)).toBeNull();

  fireEvent.click(previewButton("Close preview"));

  expect(preview().open).toBe(false);
});

test("the server render disables the controls and the thumbnails", () => {
  const container = document.createElement("div");

  container.innerHTML = renderToString(
    <ImageGallery>
      <img src="/first.png" alt="First image" />
      <img src="/second.png" alt="Second image" />
    </ImageGallery>,
  );

  expect([...container.querySelectorAll("button")].map((button) => button.disabled)).not.toContain(false);
  expect(container.querySelectorAll("[role='tab']")).toHaveLength(2);
});

test("the controls and the preview are marked with the `data-feed-omit` attribute, and the slides are not", () => {
  renderGallery();

  expect(galleryControls().hasAttribute("data-feed-omit")).toBe(true);
  expect(preview().hasAttribute("data-feed-omit")).toBe(true);
  expect(stage().closest("[data-feed-omit]")).toBeNull();
});
