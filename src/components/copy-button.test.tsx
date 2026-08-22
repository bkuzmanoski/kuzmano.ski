import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { CopyButton } from "./copy-button";

vi.mock("#/lib/audio/sounds", () => ({ playClick: vi.fn() }));

const writeText = vi.fn<(value: string) => Promise<void>>();

beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const renderButton = () =>
  render(<CopyButton value="test@example.com" label="Copy email address" confirmation="Copied" />);

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
