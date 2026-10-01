import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { playClickSound } from "#/lib/audio/sounds.ts";

import { Checkbox } from "./checkbox.tsx";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal),
);

beforeEach(() => vi.mocked(playClickSound).mockClear());

test("a checkbox renders a native checkbox named by its children and checked by its `checked` prop", () => {
  render(
    <Checkbox checked onChange={() => undefined}>
      A label
    </Checkbox>,
  );
  expect(screen.getByRole("checkbox", { name: "A label", checked: true })).toBeTruthy();
});

test("clicking a checked checkbox calls `onChange` with `false`", () => {
  const onChange = vi.fn();

  render(
    <Checkbox checked onChange={onChange}>
      A label
    </Checkbox>,
  );
  fireEvent.click(screen.getByRole("checkbox"));

  expect(onChange).toHaveBeenCalledWith(false);
});

test("pressing a checkbox with the mouse plays the click sound", () => {
  render(
    <Checkbox checked={false} onChange={() => undefined}>
      A label
    </Checkbox>,
  );
  fireEvent.pointerDown(screen.getByRole("checkbox"), { pointerType: "mouse", button: 0, isPrimary: true });

  expect(playClickSound).toHaveBeenCalledOnce();
});

test("a checkbox with the `disabled` prop renders a disabled native checkbox", () => {
  render(
    <Checkbox checked={false} disabled onChange={() => undefined}>
      A label
    </Checkbox>,
  );
  expect(screen.getByRole("checkbox").hasAttribute("disabled")).toBe(true);
});
