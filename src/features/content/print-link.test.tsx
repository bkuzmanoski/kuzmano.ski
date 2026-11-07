import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { playClickSound } from "#/lib/audio/sounds.ts";
import { pressWithMouse } from "#/test-utils/press.ts";

import { PrintLink } from "./print-link.tsx";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
);

afterEach(() => {
  vi.mocked(playClickSound).mockClear();
});

test("the print link is a button that opens the browser's print dialog", () => {
  const print = vi.fn();

  vi.stubGlobal("print", print);
  render(<PrintLink>Print</PrintLink>);
  fireEvent.click(screen.getByRole("button", { name: "Print" }));

  expect(print).toHaveBeenCalledOnce();
});

test("a press on the print link with the mouse plays the click sound", () => {
  render(<PrintLink>Print</PrintLink>);
  pressWithMouse(screen.getByRole("button", { name: "Print" }));

  expect(playClickSound).toHaveBeenCalledOnce();
});

test("the print link is marked with the `data-feed-omit` attribute", () => {
  render(<PrintLink>Print</PrintLink>);
  expect(screen.getByRole("button", { name: "Print" }).hasAttribute("data-feed-omit")).toBe(true);
});
