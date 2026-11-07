import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { resetTooltipState } from "#/lib/tooltip.ts";
import { advanceTimersBy } from "#/test-utils/timers.ts";

import { IconButton } from "./icon-button.tsx";
import { HOVER_DELAY_MS } from "./tooltip.tsx";

beforeEach(() => {
  vi.useFakeTimers();
  resetTooltipState();
});

afterEach(() => vi.useRealTimers());

const MOUSE = { pointerType: "mouse" };

const tip = () => screen.queryByRole("tooltip", { hidden: true });

function hoverUntilTooltipDelayElapses(control: HTMLElement) {
  fireEvent.pointerEnter(control.parentElement!, MOUSE);
  advanceTimersBy(HOVER_DELAY_MS);
}

test("uses its label as the button name and tooltip", () => {
  render(
    <IconButton variant="strip" label="Play">
      <svg />
    </IconButton>,
  );

  const control = screen.getByRole("button", { name: "Play" });

  hoverUntilTooltipDelayElapses(control);

  expect(tip()?.textContent).toBe("Play");
});

test("uses its label as the link name", () => {
  render(
    <IconButton variant="strip" label="Open" href="/page">
      <svg />
    </IconButton>,
  );
  expect(screen.getByRole("link", { name: "Open" }).getAttribute("href")).toBe("/page");
});

test("does not show its tooltip when disabled", () => {
  render(
    <IconButton variant="strip" label="Play" disabled>
      <svg />
    </IconButton>,
  );

  hoverUntilTooltipDelayElapses(screen.getByRole("button", { name: "Play" }));

  expect(tip()).toBeNull();
});
