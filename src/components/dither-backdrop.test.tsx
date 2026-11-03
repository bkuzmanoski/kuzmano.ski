import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { WindowRevealContext } from "#/lib/window-manager/use-is-window-revealed.ts";

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

test("the backdrop starts its animation only once the window that contains it is revealed", () => {
  const backdropInWindow = (isWindowRevealed: boolean) => (
    <WindowRevealContext value={isWindowRevealed}>
      <DitherBackdrop>Fixture content.</DitherBackdrop>
    </WindowRevealContext>
  );
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const { rerender } = render(backdropInWindow(false));

  expect(getContext).not.toHaveBeenCalled();

  rerender(backdropInWindow(true));

  expect(getContext).toHaveBeenCalled();
});
