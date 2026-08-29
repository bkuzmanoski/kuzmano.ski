import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { playError } from "#/lib/audio/sounds";
import { HIDE_DELAY_MS, STATE_DISPLAY_DURATION_MS, resetTooltipState } from "#/lib/tooltip";

import { CopyButton } from "./copy-button";
import { HOVER_DELAY_MS } from "./tooltip";

vi.mock("#/lib/audio/sounds", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, {}),
);

const writeText = vi.fn<(value: string) => Promise<void>>();

beforeEach(() => {
  vi.useFakeTimers();
  resetTooltipState();
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const renderButton = (value: string | null = "test@example.com") =>
  render(<CopyButton value={value} entity="email address" confirmation="Copied" />);

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const wrapper = () => screen.getByRole("button").parentElement!;

function hoverUntilTooltipShown() {
  fireEvent.pointerEnter(wrapper(), { pointerType: "mouse" });
  advance(HOVER_DELAY_MS);
}

const clickCopy = async () => {
  fireEvent.click(screen.getByRole("button"));

  await act(async () => {
    await Promise.resolve();
  });
};

test("clicking the button copies the value", async () => {
  renderButton();
  await clickCopy();

  expect(writeText).toHaveBeenCalledWith("test@example.com");
});

test("the button confirms a successful copy, then returns to its original state", async () => {
  renderButton();

  expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Copy to clipboard");

  await clickCopy();

  expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Copy to clipboard");
  expect(screen.getByRole("status").textContent).toBe("Copied");

  advance(STATE_DISPLAY_DURATION_MS);

  expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Copy to clipboard");
  expect(screen.getByRole("status").textContent).toBe("");
});

test("the button stays pressed until the confirmation ends", async () => {
  let completeWrite: (() => void) | undefined;

  writeText.mockReturnValue(new Promise<void>((resolve) => (completeWrite = resolve)));
  renderButton();

  expect(screen.getByRole("button").className).not.toContain("pressed");

  fireEvent.click(screen.getByRole("button"));

  expect(screen.getByRole("button").className).toContain("pressed"); // Before the write settles.

  await act(async () => {
    completeWrite?.();
    await Promise.resolve();
  });

  expect(screen.getByRole("button").className).toContain("pressed");

  advance(STATE_DISPLAY_DURATION_MS);

  expect(screen.getByRole("button").className).not.toContain("pressed");
});

test("a failed copy leaves the button in its original state and alerts the user", async () => {
  writeText.mockRejectedValue(new Error("Denied"));
  renderButton();

  await clickCopy();

  expect(screen.getByRole("button", { name: "Copy to clipboard" }).className).not.toContain("pressed");
  expect(screen.getByRole("status").textContent).toBe("");
  expect(screen.getByRole("dialog").textContent).toContain("The email address couldn’t be copied.");
  expect(playError).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByRole("button", { name: "OK" }));

  expect(screen.getByRole("dialog", { hidden: true }).hasAttribute("open")).toBe(false);
});

test("a button with a null value is disabled", async () => {
  renderButton(null);

  expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);

  await clickCopy();

  expect(writeText).not.toHaveBeenCalled();
});

test("the confirmation clears on its own delay while the pointer stays on the button", async () => {
  renderButton();
  hoverUntilTooltipShown();
  await clickCopy();

  expect(screen.getByRole("tooltip").textContent).toBe("Copied");
  expect(screen.getByRole("status").textContent).toBe("Copied");

  advance(STATE_DISPLAY_DURATION_MS - 1);

  expect(screen.getByRole("status").textContent).toBe("Copied");

  advance(1);

  expect(screen.getByRole("status").textContent).toBe("");
  expect(screen.getByRole("tooltip").textContent).toBe("Copy to clipboard"); // Still hovered.
});

test("the confirmation clears as soon as the tooltip carrying it leaves the screen", async () => {
  renderButton();
  hoverUntilTooltipShown();
  await clickCopy();

  fireEvent.pointerLeave(wrapper(), { pointerType: "mouse" });
  advance(HIDE_DELAY_MS);

  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("");
});

test("a tap shows the confirmation, then clears it after a delay", async () => {
  renderButton();
  await clickCopy();

  expect(screen.getByRole("tooltip").textContent).toBe("Copied");
  expect(screen.getByRole("status").textContent).toBe("Copied");

  advance(STATE_DISPLAY_DURATION_MS);

  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("");
});
