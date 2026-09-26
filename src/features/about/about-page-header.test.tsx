import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { AboutPageHeader } from "./about-page-header.tsx";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null); // jsdom lacks a 2D canvas context and logs when one is requested. These tests cover the no-canvas state.
});

test("the header renders its children as the statement", () => {
  render(
    <AboutPageHeader src="/image.png" alt="Fixture image">
      Fixture statement.
    </AboutPageHeader>,
  );
  expect(screen.getByText("Fixture statement.")).toBeTruthy();
});

test("the header's `<canvas>` is an image named by the `alt` prop", () => {
  render(
    <AboutPageHeader src="/image.png" alt="Fixture image">
      Fixture statement.
    </AboutPageHeader>,
  );
  expect(screen.getByRole("img", { name: "Fixture image" }).tagName).toBe("CANVAS");
});

test("the header sets the `data-content-default-styles` attribute to `off`, and the `data-content-span` attribute to `pane`", () => {
  const { container } = render(
    <AboutPageHeader src="/image.png" alt="Fixture image">
      Fixture statement.
    </AboutPageHeader>,
  );
  const header = container.firstElementChild;

  expect(header?.getAttribute("data-content-default-styles")).toBe("off");
  expect(header?.getAttribute("data-content-span")).toBe("pane");
});

test("the header preloads the picture named by the `src` prop as an image", () => {
  render(
    <AboutPageHeader src="/image.png" alt="Fixture image">
      Fixture statement.
    </AboutPageHeader>,
  );
  expect(document.head.querySelector('link[rel="preload"][as="image"]')?.getAttribute("href")).toBe("/image.png");
});
