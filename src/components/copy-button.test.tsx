import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { CopyButton } from "./copy-button";

vi.mock("#/lib/audio/sounds", () => ({ playClick: vi.fn() }));

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
  render(<CopyButton value={value} label="Copy email address" confirmation="Copied" />);

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

test("a failed copy leaves the button in its original state", async () => {
  writeText.mockRejectedValue(new Error("Denied"));
  renderButton();

  await clickCopy();

  expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Copy email address");
});

test("a button with nothing to copy yet is disabled and copies nothing", async () => {
  renderButton(null);

  expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);

  await clickCopy();

  expect(writeText).not.toHaveBeenCalled();
});
