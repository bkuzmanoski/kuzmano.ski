import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { DitherBackdrop } from "./dither-backdrop.tsx";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null); // jsdom lacks a 2D canvas context and logs when one is requested. These tests cover the no-canvas state.
});

test("the backdrop renders its children", () => {
  render(<DitherBackdrop>Fixture content.</DitherBackdrop>);
  expect(screen.getByText("Fixture content.")).toBeTruthy();
});

test("the backdrop hides its `<canvas>` from assistive technologies", () => {
  const { container } = render(<DitherBackdrop>Fixture content.</DitherBackdrop>);
  expect(container.querySelector("canvas")?.getAttribute("aria-hidden")).toBe("true");
});

test("the backdrop passes its other props to its container, and adds the `className` prop to the container's own class", () => {
  const { container } = render(
    <DitherBackdrop className="fixture-class" data-content-span="pane">
      Fixture content.
    </DitherBackdrop>,
  );
  const backdropContainer = container.firstElementChild;

  expect(backdropContainer?.getAttribute("data-content-span")).toBe("pane");
  expect(backdropContainer?.classList).toContain("fixture-class");
  expect(backdropContainer?.classList.length).toBeGreaterThan(1);
});
