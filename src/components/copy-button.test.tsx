import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { playErrorSound } from "#/lib/audio/sounds.ts";
import { HIDE_DELAY_MS, STATE_DISPLAY_DURATION_MS, resetTooltipState } from "#/lib/tooltip.ts";
import { deferWrite } from "#/test-utils/clipboard.ts";
import { advanceTimersBy } from "#/test-utils/timers.ts";

import { CopyButton } from "./copy-button.tsx";
import { HOVER_DELAY_MS } from "./tooltip.tsx";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
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

const wrapper = () => screen.getByRole("button").parentElement!;

function hoverUntilTooltipShown() {
  fireEvent.pointerEnter(wrapper(), { pointerType: "mouse" });
  advanceTimersBy(HOVER_DELAY_MS);
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

test("the button announces the confirmation after a successful copy without changing its label, then clears it after the state display duration", async () => {
  renderButton();

  expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Copy to clipboard");

  await clickCopy();

  expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Copy to clipboard");
  expect(screen.getByRole("status").textContent).toBe("Copied");

  advanceTimersBy(STATE_DISPLAY_DURATION_MS);

  expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Copy to clipboard");
  expect(screen.getByRole("status").textContent).toBe("");
});

test("the button stays pressed until the confirmation clears", async () => {
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

  advanceTimersBy(STATE_DISPLAY_DURATION_MS);

  expect(screen.getByRole("button").className).not.toContain("pressed");
});

test("a failed copy shows an alert and does not show the confirmation or leave the button pressed", async () => {
  writeText.mockRejectedValue(new Error("Denied"));
  renderButton();

  await clickCopy();

  expect(screen.getByRole("button", { name: "Copy to clipboard" }).className).not.toContain("pressed");
  expect(screen.getByRole("status").textContent).toBe("");
  expect(screen.getByRole("alertdialog").textContent).toContain("The email address couldn’t be copied.");
  expect(playErrorSound).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByRole("button", { name: "OK" }));

  expect(screen.getByRole("alertdialog", { hidden: true }).hasAttribute("open")).toBe(false);
});

test("the button ignores a press while its copy is pending, and confirms that copy", async () => {
  renderButton();

  const write = deferWrite(writeText);

  await clickCopy();
  await clickCopy();
  await write.succeed();

  expect(writeText).toHaveBeenCalledOnce();
  expect(screen.getByRole("status").textContent).toBe("Copied");
});

test("the button ignores a press while its copy is confirmed, without restarting the confirmation", async () => {
  renderButton();
  await clickCopy();
  await clickCopy();

  expect(writeText).toHaveBeenCalledOnce();
  expect(screen.getByRole("status").textContent).toBe("Copied");

  advanceTimersBy(STATE_DISPLAY_DURATION_MS);

  expect(screen.getByRole("status").textContent).toBe(""); // The confirmation was not restarted by the second press.
});

test("a button with a `null` value is disabled", async () => {
  renderButton(null);

  expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);

  await clickCopy();

  expect(writeText).not.toHaveBeenCalled();
});

test("the confirmation clears after the state display duration while the pointer stays on the button", async () => {
  renderButton();
  hoverUntilTooltipShown();
  await clickCopy();

  expect(screen.getByRole("tooltip").textContent).toBe("Copied");
  expect(screen.getByRole("status").textContent).toBe("Copied");

  advanceTimersBy(STATE_DISPLAY_DURATION_MS - 1);

  expect(screen.getByRole("status").textContent).toBe("Copied");

  advanceTimersBy(1);

  expect(screen.getByRole("status").textContent).toBe("");
  expect(screen.getByRole("tooltip").textContent).toBe("Copy to clipboard"); // Still hovered.
});

test("the confirmation clears as soon as the tooltip showing it is hidden", async () => {
  renderButton();
  hoverUntilTooltipShown();
  await clickCopy();

  fireEvent.pointerLeave(wrapper(), { pointerType: "mouse" });
  advanceTimersBy(HIDE_DELAY_MS);

  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("");
});

test("a tap shows the confirmation, then clears it after the state display duration", async () => {
  renderButton();
  await clickCopy();

  expect(screen.getByRole("tooltip").textContent).toBe("Copied");
  expect(screen.getByRole("status").textContent).toBe("Copied");

  advanceTimersBy(STATE_DISPLAY_DURATION_MS);

  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("");
});
