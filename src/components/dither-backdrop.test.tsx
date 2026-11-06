import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { beforeEach, expect, test, vi } from "vitest";

import { startDitherBackdropAnimation } from "#/lib/dither/backdrop-animation.ts";
import type { startDitherBackdropAnimation as StartDitherBackdropAnimation } from "#/lib/dither/backdrop-animation.ts";
import { WindowRevealContext } from "#/lib/window-manager/use-is-window-revealed.ts";

import styles from "./dither-backdrop.module.css";
import { DitherBackdrop } from "./dither-backdrop.tsx";

vi.mock("#/lib/dither/backdrop-animation.ts", () => ({
  startDitherBackdropAnimation: vi.fn<typeof StartDitherBackdropAnimation>(() => () => undefined),
}));

beforeEach(() => {
  vi.mocked(startDitherBackdropAnimation).mockClear();
});

test("the backdrop renders its children", () => {
  render(<DitherBackdrop>Fixture content.</DitherBackdrop>);
  expect(screen.getByText("Fixture content.")).toBeTruthy();
});

test("the backdrop hides its `<canvas>` from assistive technology", () => {
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
  expect(backdropContainer?.classList).toContain(styles.container);
});

test("the backdrop attaches the `ref` prop to its container", () => {
  const ref = createRef<HTMLDivElement>();
  const { container } = render(<DitherBackdrop ref={ref}>Fixture content.</DitherBackdrop>);

  expect(ref.current).toBe(container.firstElementChild);
});

test("the backdrop starts its animation only once the window that contains it is revealed", () => {
  const backdropInWindow = (isWindowRevealed: boolean) => (
    <WindowRevealContext value={isWindowRevealed}>
      <DitherBackdrop>Fixture content.</DitherBackdrop>
    </WindowRevealContext>
  );
  const { rerender } = render(backdropInWindow(false));

  expect(startDitherBackdropAnimation).not.toHaveBeenCalled();

  rerender(backdropInWindow(true));

  expect(startDitherBackdropAnimation).toHaveBeenCalledOnce();
});

test("the backdrop centers the highlight on the element of the `highlightCenterRef` prop", () => {
  const highlightCenterRef = createRef<HTMLSpanElement>();

  render(
    <DitherBackdrop highlightCenterRef={highlightCenterRef}>
      <span ref={highlightCenterRef}>Fixture content.</span>
    </DitherBackdrop>,
  );

  expect(highlightCenterRef.current).not.toBeNull();
  expect(startDitherBackdropAnimation).toHaveBeenLastCalledWith(
    expect.objectContaining({ highlightCenterElement: highlightCenterRef.current }),
  );
});
