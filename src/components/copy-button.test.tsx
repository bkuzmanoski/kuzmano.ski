import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { playError } from "#/lib/audio/sounds";

import { CopyButton } from "./copy-button";

vi.mock("#/lib/audio/sounds", () => ({ playClick: vi.fn(), playError: vi.fn() }));

const writeText = vi.fn<(value: string) => Promise<void>>();

beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const renderButton = (value: string | null = "test@example.com") =>
  render(<CopyButton value={value} entity="email address" label="Copy email address" confirmation="Copied" />);

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

test("the button confirms a successful copy and returns to its original state", async () => {
  renderButton();

  expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Copy email address");

  await clickCopy();

  expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Copy email address");
  expect(screen.getByRole("status").textContent).toBe("Copied");

  act(() => {
    vi.advanceTimersByTime(2_000);
  });

  expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Copy email address");
  expect(screen.getByRole("status").textContent).toBe("");
});

test("the button stays pressed from the press until the confirmation ends", async () => {
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

  act(() => {
    vi.advanceTimersByTime(2_000);
  });

  expect(screen.getByRole("button").className).not.toContain("pressed");
});

test("a failed copy leaves the button in its original state and alerts the reader", async () => {
  writeText.mockRejectedValue(new Error("Denied"));
  renderButton();

  await clickCopy();

  expect(screen.getByRole("button", { name: "Copy email address" }).className).not.toContain("pressed");
  expect(screen.getByRole("status").textContent).toBe("");
  expect(screen.getByRole("dialog").textContent).toContain("The email address couldn’t be copied.");
  expect(playError).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByRole("button", { name: "OK" }));

  expect(screen.getByRole("dialog", { hidden: true }).hasAttribute("open")).toBe(false);
});

test("a button with nothing to copy yet is disabled and copies nothing", async () => {
  renderButton(null);

  expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);

  await clickCopy();

  expect(writeText).not.toHaveBeenCalled();
});
