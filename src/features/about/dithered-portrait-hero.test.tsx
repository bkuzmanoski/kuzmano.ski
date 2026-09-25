import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { DitheredPortraitHero } from "./dithered-portrait-hero.tsx";

beforeEach(() => {
  // jsdom lacks a 2D canvas context and logs when one is requested. These tests cover the no-canvas state.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

test("the hero renders its children as the statement", () => {
  render(
    <DitheredPortraitHero src="/image.png" alt="Fixture image">
      Fixture statement.
    </DitheredPortraitHero>,
  );

  expect(screen.getByText("Fixture statement.")).toBeTruthy();
});

test("the hero's `<canvas>` is an image named by the `alt` prop", () => {
  render(
    <DitheredPortraitHero src="/image.png" alt="Fixture image">
      Fixture statement.
    </DitheredPortraitHero>,
  );

  expect(screen.getByRole("img", { name: "Fixture image" }).tagName).toBe("CANVAS");
});

test("the hero sets the `data-content-default-styles` attribute to `off`, and is marked with the `data-content-full-bleed` attribute", () => {
  const { container } = render(
    <DitheredPortraitHero src="/image.png" alt="Fixture image">
      Fixture statement.
    </DitheredPortraitHero>,
  );
  const hero = container.firstElementChild;

  expect(hero?.getAttribute("data-content-default-styles")).toBe("off");
  expect(hero?.hasAttribute("data-content-full-bleed")).toBe(true);
});

test("the hero preloads the picture named by the `src` prop as an image", () => {
  render(
    <DitheredPortraitHero src="/image.png" alt="Fixture image">
      Fixture statement.
    </DitheredPortraitHero>,
  );

  expect(document.head.querySelector('link[rel="preload"][as="image"]')?.getAttribute("href")).toBe("/image.png");
});
